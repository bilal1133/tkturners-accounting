import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useForm } from "react-hook-form";
import axios from "axios";
import { API_URL } from "../lib/api";
import { Lock, Mail, Loader2 } from "lucide-react";

interface LoginFormValues {
  email: string;
  password: string;
  remember: boolean;
}

interface LoginResponse {
  jwt: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}

export const LoginPage = () => {
  const { register, handleSubmit } = useForm<LoginFormValues>({
    defaultValues: {
      remember: true,
    },
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginFormValues) => {
    setError("");
    setLoading(true);

    try {
      const response = await axios.post<LoginResponse>(
        `${API_URL}/api/auth/local`,
        {
          identifier: data.email,
          password: data.password,
        },
      );

      login(response.data.jwt, response.data.user, data.remember);
      navigate("/");
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.error?.message || "Invalid email or password",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center border-b border-slate-800 bg-slate-900/50">
          <div className="mx-auto bg-indigo-500/10 w-16 h-16 rounded-2xl flex items-center justify-center border border-indigo-500/20 mb-4">
            <Lock className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Partner Accounting
          </h1>
          <p className="text-slate-400 text-sm">
            Sign in to access your financial dashboard.
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  {...register("email")}
                  className="w-full pl-10 bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-500"
                  placeholder="admin@tkturners.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  {...register("password")}
                  className="w-full pl-10 bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-500"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                {...register("remember")}
                className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
              />
              Keep me signed in on this device
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-70 mt-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Log In Securely"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
