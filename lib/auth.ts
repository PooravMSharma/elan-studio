import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { TENANT_SLUG } from "./tenant";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string;
      role: string;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const tenant = await prisma.tenant.findUnique({
          where: { slug: TENANT_SLUG },
          select: { id: true },
        });
        if (!tenant) return null;

        const user = await prisma.adminUser.findUnique({
          where: { tenantId_email: { tenantId: tenant.id, email } },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.tenantId = token.tenantId as string;
      session.user.role = token.role as string;
      return session;
    },
  },
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Not authenticated");
  return session;
}