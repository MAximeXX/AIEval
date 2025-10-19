# -*- coding: utf-8 -*-
import pandas as pd
import re
import os

# === 配置路径 ===
in_path = 'acc_pass/信息汇总表.xlsx'
out_path = 'acc_pass/acc_pass.csv'

# === 依赖: pypinyin，用于无声调、全小写、连写的拼音 ===
from pypinyin import lazy_pinyin, Style

def to_pinyin_joined(name: str) -> str:
    """无声调、全小写、连写"""
    return "".join(lazy_pinyin(name, style=Style.NORMAL)).lower()

# === 提取数字（支持中文数字到20） ===
CN_NUM = {'零':0,'〇':0,'○':0,'O':0,'o':0,
          '一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}

def extract_int(txt):
    """从类似“一年级”“（1）班”“10班”中提取数字；能识别到20"""
    if pd.isna(txt):
        return None
    s = str(txt).strip()
    # 先取阿拉伯数字
    m = re.search(r'\d+', s)
    if m:
        return int(m.group())
    # 简单中文数字规则（到20）
    if '十' in s:
        left, _, right = s.partition('十')
        tens = CN_NUM.get(left, 1) if left != '' else 1
        ones = CN_NUM.get(right, 0) if right != '' else 0
        val = tens * 10 + ones
        return val if val > 0 else None
    if len(s) == 1 and s in CN_NUM:
        return CN_NUM[s]
    return None

def fmt_stu_no_2d(x):
    """学号两位：01, 02 ...；从混合文本中抽取数字"""
    if pd.isna(x):
        return ''
    s = str(x).strip()
    m = re.search(r'\d+', s)
    if m:
        return f"{int(m.group()):02d}"
    return s  # 无数字就原样返回

def is_teacher(val):
    if pd.isna(val):
        return False
    s = str(val).strip().lower()
    return s in ['teacher','教师','老师','教职工','教工']

# === 读取 Excel ===
if not os.path.exists(in_path):
    raise FileNotFoundError(f"未找到输入文件：{in_path}")

df = pd.read_excel(in_path)
df.columns = [str(c).strip() for c in df.columns]

# === 列名映射（尽量兼容中/英文）===
col_map_cands = {
    'grade':    ['grade','年级'],
    'class':    ['class','班级'],
    'name':     ['name','姓名'],
    'number':   ['number','学号','编号','序号','#'],
    'category': ['category','类别','类型','身份']
}
def find_col(cands):
    lower_cols = {c.lower(): c for c in df.columns}
    for c in cands:
        if c in df.columns:
            return c
        if c.lower() in lower_cols:
            return lower_cols[c.lower()]
    return None

src_cols = {k: find_col(v) for k, v in col_map_cands.items()}

# === 构建输出基础列 ===
out = pd.DataFrame()
out['grade'] = df[src_cols['grade']] if src_cols['grade'] else pd.NA
out['class'] = df[src_cols['class']] if src_cols['class'] else pd.NA

# 清除姓名中的所有空格（半角/全角/各种空白）
if src_cols['name']:
    name_raw = df[src_cols['name']].astype(str)
    name_clean = name_raw.str.replace(r'[\s\u00A0\u2000-\u200D\u3000]+', '', regex=True)
else:
    name_clean = pd.Series([pd.NA]*len(df))

out['name'] = name_clean
out['number'] = df[src_cols['number']] if src_cols['number'] else pd.NA

# === 预处理辅助值 ===
grade_num = out['grade'].apply(extract_int)
class_num = out['class'].apply(extract_int)
stu_no_2d = out['number'].apply(fmt_stu_no_2d)
name_pinyin = out['name'].apply(lambda s: '' if pd.isna(s) else to_pinyin_joined(str(s)))
category_is_teacher = df[src_cols['category']].apply(is_teacher) if src_cols['category'] else pd.Series([False]*len(df))

# === 生成账号/密码 ===
accounts = []
passwords = []
for i in range(len(out)):
    g = grade_num.iloc[i] or ''
    c = class_num.iloc[i] or ''
    gc = f"{g}{c}"  # 年级+班级
    nm_py = name_pinyin.iloc[i]
    num_raw = out['number'].iloc[i]

    if category_is_teacher.iloc[i]:
        # 教师：账号 T-nanhu{年级}{班级}
        account = f"T-nanhu{gc}"
        # 教师密码：{姓名拼音}{年级}{班级}{number或#}
        if pd.isna(num_raw) or str(num_raw).strip()=='':
            num_part = '#'
        else:
            m = re.search(r'\d+', str(num_raw))
            num_part = m.group() if m else str(num_raw).strip()
        password = f"{nm_py}{num_part}{gc}"
    else:
        # 学生：账号 nanhu{年级}{班级}{学号(两位)}；密码 {姓名拼音}{学号(两位)}
        account = f"nanhu{gc}{stu_no_2d.iloc[i]}"
        password = f"{nm_py}{stu_no_2d.iloc[i]}"

    accounts.append(account)
    passwords.append(password)

out['account'] = accounts
out['password'] = passwords

# === 导出 CSV ===
os.makedirs(os.path.dirname(out_path), exist_ok=True)
out[['grade','class','name','number','account','password']].to_csv(out_path, index=False, encoding='utf-8-sig')

print(f"已生成：{out_path}")
