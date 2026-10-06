import type { Metadata } from "next";
import Image from "next/image";
import { getContent } from "@/lib/content";
import { getTeam } from "@/lib/site-content";

export const metadata: Metadata = { title: "About FAGDAN", alternates: { canonical: "/about" } };
export const dynamic = "force-dynamic";

const initials = (name: string) => name.replace(/^(mr|mrs|ms|dr|chief|engr)\.?\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export default async function About() {
  const [c, team] = await Promise.all([getContent(), getTeam()]);
  const story = c.t("pages.about.story").split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="container-x py-10 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">{c.t("pages.about.heading")}</h1>
        <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted">{story.map((p, i) => <p key={i}>{p}</p>)}</div>
      </div>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{c.lines("pages.about.points").map((t) => <li key={t} className="card p-4 text-sm font-medium text-navy">{t}</li>)}</ul>

      <section className="mt-14" aria-labelledby="team-h">
        <h2 id="team-h" className="font-display text-2xl font-extrabold text-navy sm:text-3xl">{c.t("pages.about.teamTitle")}</h2>
        <p className="mt-2 max-w-2xl text-muted">{c.t("pages.about.teamIntro")}</p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => (
            <li key={m.id ?? m.name} className="card overflow-hidden">
              <div className="relative aspect-[4/5] bg-gradient-to-br from-brand-50 to-brand-100">
                {m.photoUrl ? (
                  <Image src={m.photoUrl} alt={`${m.name}, ${m.role}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover object-top" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-brand/70" role="img" aria-label={`Photo of ${m.name} coming soon`}>
                    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/70 font-display text-3xl font-extrabold">{initials(m.name)}</span>
                    <span className="text-xs font-medium">Photo coming soon</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-display text-xl font-bold text-navy">{m.name}</h3>
                <p className="text-sm font-semibold text-accent-600">{m.role}</p>
                {m.bio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{m.bio}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
