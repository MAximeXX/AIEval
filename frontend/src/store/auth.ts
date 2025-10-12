import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserProfile = {
  id: string;
  username: string;
  role: string;
  school_name?: string | null;
  student_name?: string | null;
  teacher_name?: string | null;
  class_no?: string | null;
  grade?: number | null;
  grade_band?: string | null;
};

type AuthState = {
  token: string | null;
  role: string | null;
  sessionId: string | null;
  user: UserProfile | null;
  setAuth: (payload: {
    token: string;
    role: string;
    sessionId: string;
    user: UserProfile;
  }) => void;
  clear: () => void;
};

export const useAuthStore = create(
  persist<AuthState>(
    (set) => ({
      token: null,
      role: null,
      sessionId: null,
      user: null,
      setAuth: ({ token, role, sessionId, user }) =>
        set({ token, role, sessionId, user }),
      clear: () =>
        set({ token: null, role: null, sessionId: null, user: null }),
    }),
    { name: "butterfly-auth" },
  ),
);
