import { redirect } from "next/navigation";
import { Droplets } from "lucide-react";
import { currentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <main className="grid min-h-screen place-items-center bg-[#173f31] p-5">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[1.1fr_.9fr]">
        <section className="hidden bg-[#d9ef61] p-12 md:block">
          <Droplets size={42} />
          <h1 className="mt-16 text-5xl font-black leading-[.95]">
            Every tower.
            <br />
            Every deadline.
            <br />
            One clear plan.
          </h1>
          <p className="mt-6 max-w-sm text-lg text-emerald-950/70">
            Legionella-first scheduling that keeps compliance timing ahead of
            route efficiency.
          </p>
        </section>
        <section className="p-8 md:p-12">
          <div className="label text-emerald-800">Internal access</div>
          <h2 className="mt-2 text-3xl font-black">Sign in to TowerTrack</h2>
          <p className="mt-2 text-slate-600">
            Public registration is disabled.
          </p>
          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800"
            >
              Email or password was incorrect.
            </div>
          )}
          <form action="/api/login" method="post" className="mt-7 space-y-5">
            <label className="block">
              <span className="label">Email</span>
              <input
                name="email"
                type="email"
                required
                className="field mt-2"
                defaultValue={demoMode ? "admin@towertrack.local" : undefined}
              />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input
                name="password"
                type="password"
                required
                className="field mt-2"
                defaultValue={demoMode ? "ChangeMe123!" : undefined}
              />
            </label>
            <button className="btn btn-primary w-full">Sign in</button>
          </form>
          {demoMode && (
            <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <b>Fictional demo:</b> demo@towertrack.local / DemoOnly123!
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
