import { Navigate, Route, Routes } from "react-router-dom";

import StudentLayout from "./StudentLayout";
import WelcomePage from "./WelcomePage";
import SurveyPage from "./SurveyPage";
import TeacherReviewPage from "./TeacherReviewPage";
import AiEvaluationPage from "./AiEvaluationPage";

const StudentRoutes = () => (
  <StudentLayout>
    <Routes>
      <Route path="welcome" element={<WelcomePage />} />
      <Route path="survey" element={<SurveyPage />} />
      <Route path="review" element={<TeacherReviewPage />} />
      <Route path="ai" element={<AiEvaluationPage />} />
      <Route path="*" element={<Navigate to="welcome" replace />} />
    </Routes>
  </StudentLayout>
);

export default StudentRoutes;
