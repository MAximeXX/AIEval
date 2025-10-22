import { Navigate, Route, Routes } from "react-router-dom";

import TeacherLayout from "./TeacherLayout";
import TeacherDashboard from "./TeacherDashboard";
import TeacherStudentPage from "./TeacherStudentPage";
import TeacherAiEvaluationPage from "./TeacherAiEvaluationPage";

const TeacherRoutes = () => (
  <Routes>
    <Route element={<TeacherLayout />}>
      <Route index element={<TeacherDashboard />} />
      <Route path="students/:studentId" element={<TeacherStudentPage />} />
      <Route path="students/:studentId/ai" element={<TeacherAiEvaluationPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/teacher" replace />} />
  </Routes>
);

export default TeacherRoutes;
