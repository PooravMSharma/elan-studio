import { signIn } from "@/lib/auth";

export const metadata = { title: "Sign in · Élan Studio" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="login">
      <form
        className="login__card"
        action={async (formData: FormData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: next ?? "/admin",
          });
        }}
      >
        <p className="eyebrow">Élan Studio</p>
        <h1>Sign in</h1>

        {error && (
          <p className="error" role="alert">
            Those details didn&rsquo;t match. Try again.
          </p>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}