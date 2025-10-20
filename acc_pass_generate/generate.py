# -*- coding: utf-8 -*-
import pandas as pd
import re
import os

# 如果没安装，请先在命令行/Notebook里执行：pip install pypinyin
from pypinyin import lazy_pinyin, Style

# ====== 路径设置 ======
in_path  = 'acc_pass/信息汇总表.xlsx'
out_path = 'acc_pass/acc_pass.csv'

if not os.path.exists(in_path):
    raise FileNotFoundError(f'未找到文件：{in_path}')

# ====== 读取与列名规范化 ======
df = pd.read_excel(in_path)
df.columns = [str(c).strip() for c in df.columns]

# 支持中英文列名映射
def pick_col(*cands):
    for c in cands:
        if c in df.columns:
            return c
    # case-insensitive
    lowmap = {c.lower(): c for c in df.columns}
    for c in cands:
        if c.lower() in lowmap:
            return lowmap[c.lower()]
    return None

col_grade    = pick_col('grade', '年级')
col_class    = pick_col('class', '班级')
col_name     = pick_col('name', '姓名')
col_number   = pick_col('number', '学号', '编号', '序号', '#')
col_category = pick_col('category', '类别', '类型', '身份')

# ====== 清理姓名空格（含全角空格） ======
if col_name:
    df[col_name] = df[col_name].astype(str).apply(lambda s: re.sub(r'[\s\u3000]+', '', s.strip()))
else:
    df['姓名_缺失'] = ''

# ====== 提取年级/班级数字（支持中文数字） ======
cn_num_map = {'零':0,'〇':0,'○':0,'O':0,'o':0,
              '一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}

def to_int_gc(x):
    if pd.isna(x): return None
    s = str(x).strip()
    m = re.search(r'\d+', s)
    if m:
        return int(m.group())
    # 简单中文数字到 20
    if '十' in s:
        left, _, right = s.partition('十')
        tens = cn_num_map.get(left, 1) if left != '' else 1
        ones = cn_num_map.get(right, 0) if right != '' else 0
        val = tens*10 + ones
        return val if val>0 else None
    if len(s)==1 and s in cn_num_map:
        return cn_num_map[s]
    return None

grade_num = df[col_grade].apply(to_int_gc) if col_grade else pd.Series([None]*len(df))
class_num = df[col_class].apply(to_int_gc) if col_class else pd.Series([None]*len(df))

# 合成“年级班级”拼块（纯数字连写）
gc_join = pd.Series([
    f"{'' if pd.isna(g) else int(g)}{'' if pd.isna(c) else int(c)}"
    for g, c in zip(grade_num, class_num)
])

# ====== 学号两位化（学生用） ======
def fmt_no2(x):
    if pd.isna(x): return ''
    s = str(x).strip()
    m = re.search(r'\d+', s)
    if m:
        return f"{int(m.group()):02d}"
    return s  # 若没有纯数字，保留原样

stu_no2 = df[col_number].apply(fmt_no2) if col_number else pd.Series(['']*len(df))

# ====== 姓名转拼音：无声调、全小写、连写 ======
def name_to_pinyin(x):
    if pd.isna(x): return ''
    return "".join(lazy_pinyin(str(x), style=Style.NORMAL)).lower()

name_py = df[col_name].apply(name_to_pinyin) if col_name else pd.Series(['']*len(df))

# ====== 识别是否教师 ======
def is_teacher(v):
    if pd.isna(v): return False
    s = str(v).strip().lower()
    return s in ['teacher', '教师', '老师', '教职工', '教工']

is_t = df[col_category].apply(is_teacher) if col_category else pd.Series([False]*len(df))

# ====== 生成账号与密码 ======
accounts = []
passwords = []

for i in range(len(df)):
    gc = gc_join.iloc[i]
    nm_py = name_py.iloc[i]
    num_raw = df[col_number].iloc[i] if col_number else ''
    if is_t.iloc[i]:
        # 教师：账号 T-nanhu{number}{年级}{班级}；密码 {姓名拼音}{年级}{班级}
        num_part = ''
        if not pd.isna(num_raw) and str(num_raw).strip() != '':
            m = re.search(r'\d+', str(num_raw))
            num_part = m.group() if m else str(num_raw).strip()
        accounts.append(f"T-nanhu{num_part}{gc}")
        passwords.append(f"{nm_py}{gc}")
    else:
        # 学生：账号 nanhu{年级}{班级}{学号(两位)}；密码 {姓名拼音}{学号(两位)}
        accounts.append(f"nanhu{gc}{stu_no2.iloc[i]}")
        passwords.append(f"{nm_py}{stu_no2.iloc[i]}")

# ====== 组装输出并保存 ======
out = pd.DataFrame({
    'grade':   df[col_grade] if col_grade else pd.NA,
    'class':   df[col_class] if col_class else pd.NA,
    'name':    df[col_name]  if col_name  else pd.NA,
    'number':  df[col_number] if col_number else pd.NA,
    'account': accounts,
    'password': passwords
})

# 确保输出目录存在
os.makedirs(os.path.dirname(out_path), exist_ok=True)
out.to_csv(out_path, index=False, encoding='utf-8-sig')

print(f'已生成：{out_path}')
print(out.head(10))
