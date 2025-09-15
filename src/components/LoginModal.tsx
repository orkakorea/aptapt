import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
});

const signupSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  confirmPassword: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            variant: "destructive",
            title: "로그인 실패",
            description: "이메일 또는 비밀번호를 확인해주세요.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "로그인 실패",
            description: error.message,
          });
        }
        return;
      }

      if (authData.user) {
        toast({
          title: "로그인 성공",
          description: "환영합니다!",
        });
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "오류 발생",
        description: "로그인 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            variant: "destructive",
            title: "회원가입 실패",
            description: "이미 가입된 이메일입니다. 로그인을 시도해주세요.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "회원가입 실패",
            description: error.message,
          });
        }
        return;
      }

      if (authData.user) {
        toast({
          title: "회원가입 성공",
          description: "이메일을 확인하여 계정을 활성화해주세요.",
        });
        setIsSignup(false);
        signupForm.reset();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "오류 발생",
        description: "회원가입 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignup(!isSignup);
    loginForm.reset();
    signupForm.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isSignup ? "회원가입" : "로그인"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isSignup 
              ? "새 계정을 만들어 서비스를 이용해보세요" 
              : "계정에 로그인하여 서비스를 이용해보세요"
            }
          </DialogDescription>
        </DialogHeader>

        {isSignup ? (
          <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email">이메일</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="이메일을 입력해주세요"
                {...signupForm.register("email")}
              />
              {signupForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {signupForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">비밀번호</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="비밀번호를 입력해주세요"
                {...signupForm.register("password")}
              />
              {signupForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {signupForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password">비밀번호 확인</Label>
              <Input
                id="signup-confirm-password"
                type="password"
                placeholder="비밀번호를 다시 입력해주세요"
                {...signupForm.register("confirmPassword")}
              />
              {signupForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {signupForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "처리중..." : "회원가입"}
            </Button>
          </form>
        ) : (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">이메일</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="이메일을 입력해주세요"
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">비밀번호</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="비밀번호를 입력해주세요"
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "처리중..." : "로그인"}
            </Button>
          </form>
        )}

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={switchMode}
            disabled={isLoading}
          >
            {isSignup 
              ? "이미 계정이 있으신가요? 로그인" 
              : "계정이 없으신가요? 회원가입"
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}