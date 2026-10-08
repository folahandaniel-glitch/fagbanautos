import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guard";
import { getSetting } from "@/lib/settings";
import { photosWaiting } from "@/lib/images/batch";
import { getBraveKey } from "@/lib/images/search";
import { savePhotoSettings, recheckAll } from "@/app/actions/admin-photos";
import { PageHeader, Notice } from "@/components/admin/ui";
import { PhotoBatchRunner } from "@/components/admin/PhotoBatchRunner";

export const metadata: Metadata = { title: "Photo finder", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PhotosAdmin({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffPage();
  if (!["products:edit", "vehicles:edit", "inventory:edit", "settings:manage"].some((p) => user.permissions.has(p))) await requireStaffPage("products:edit");
  const sp = await searchParams;
  const canSettings = user.permissions.has("settings:manage");
  const canRun = ["products:edit", "vehicles:edit", "inventory:edit"].some((p) => user.permissions.has(p));
  const [remaining, key, autoSearch, vendorOnly] = await Promise.all([photosWaiting(), getBraveKey(), getSetting<boolean>("images.autoSearch"), getSetting<boolean>("images.vendorOnly")]);
  return (
    <>
      <PageHeader title="Photo finder" sub="Finds real product photos in the background. Customers never wait for it." />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-navy">Find photos now</h2>
          <PhotoBatchRunner initialRemaining={remaining} searchReady={!!key} canRun={canRun} />
          <p className="text-xs text-muted">Order of search: the product page or brand website you entered, then the manufacturer&apos;s official site through web search, then licensed libraries. A photo is only used if it mentions the model. It also runs once a day for leftovers. Pictures are compressed and kept in your own storage. Uploaded photos are never replaced.</p>
          {canSettings && <form action={recheckAll}><button className="btn-ghost text-xs">Search listings that had nothing found again</button></form>}
        </section>
        {canSettings ? (
          <form action={savePhotoSettings} className="card space-y-4 p-5">
            <h2 className="font-display text-lg font-bold text-navy">Search settings</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoSearch" defaultChecked={autoSearch !== false} className="h-4 w-4" /> Search the web for photos automatically</label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="vendorOnly" defaultChecked={vendorOnly !== false} className="mt-1 h-4 w-4" /> <span>Only accept photos from the manufacturer&apos;s official website <span className="block text-xs text-muted">Recommended: other websites usually own their pictures.</span></span></label>
            <div>
              <label className="label" htmlFor="braveKey">Brave Search API key {key ? <span className="ml-1 rounded-full bg-ok/10 px-2 py-0.5 text-xs text-ok">saved</span> : <span className="ml-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">not set</span>}</label>
              <input id="braveKey" name="braveKey" type="password" autoComplete="off" placeholder={key ? "Leave blank to keep the saved key" : "Paste the key from brave.com/search/api"} className="input" />
              <p className="mt-1 text-xs text-muted">Stored encrypted; never shown again. The free plan allows about one search per second.</p>
            </div>
            {key && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="clearKey" className="h-4 w-4" /> Remove the saved key</label>}
            <button className="btn-primary">Save</button>
          </form>
        ) : <Notice>Only a settings manager can change the search key and rules.</Notice>}
      </div>
    </>
  );
}
