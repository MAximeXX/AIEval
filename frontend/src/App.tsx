import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";

import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import StudentRoutes from "./pages/student/StudentRoutes";
import TeacherRoutes from "./pages/teacher/TeacherRoutes";
import AdminRoutes from "./pages/admin/AdminRoutes";

type RequireAuthProps = {
  children: JSX.Element;
  allowedRoles: string[];
};

const RequireAuth = ({ children, allowedRoles }: RequireAuthProps) => {
  const { token, role } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    document.title = "小彩蝶劳动益美行评测";
  }, []);

  if (!token || !role) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/student/*"
      element={
        <RequireAuth allowedRoles={["student"]}>
          <StudentRoutes />
        </RequireAuth>
      }
    />
    <Route
      path="/teacher/*"
      element={
        <RequireAuth allowedRoles={["teacher", "admin"]}>
          <TeacherRoutes />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/*"
      element={
        <RequireAuth allowedRoles={["admin"]}>
          <AdminRoutes />
        </RequireAuth>
      }
    />
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

export default App;
