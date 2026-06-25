import type { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role?: Role;
    avatarColor?: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      avatarColor: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    avatarColor: string;
  }
}
