import React, { useEffect, useState } from "react";
import { BookOpen, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { api } from "../services/api";

export const EResources = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadResources = async () => {
    setLoading(true);
    setError("");
    try {
      setResources(await api.eResources.list(true));
    } catch (requestError) {
      setError(requestError.message || "Unable to load E-Resources.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  return (
    <section className="min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-3 sm:pb-4">
        <div className="min-w-0">
          <span className="text-[9px] sm:text-[15px] font-mono font-black tracking-[0.5em] sm:tracking-[0.2em] text-blue-600 uppercase">Cagayan Provincial Learning and Resource Center </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1">E-Resource</h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">Explore the electronic libraries and learning platforms available through CPLRC.</p>
        </div>
        <button type="button" onClick={loadResources} className="w-full sm:w-fit inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold uppercase tracking-wider text-slate-500">
          <LoaderCircle size={18} className="animate-spin text-blue-600" /> Loading E-Resources
        </div>
      )}
      {!loading && error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">{error}</div>}
      {!loading && !error && resources.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-semibold text-slate-500">
          <BookOpen size={30} className="mx-auto mb-3 text-slate-300" />
          No active E-Resources are available yet.
        </div>
      )}
      {!loading && !error && resources.length > 0 && (
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {resources.map((resource) => (
            <article key={resource.id} className="mx-auto flex w-full max-w-[300px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
              <div className="h-24 sm:h-28 bg-slate-100 border-b border-slate-100 p-2.5 flex items-center justify-center">
                <img src={resource.image} alt={resource.title} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-3">
                <h3 className="break-words text-sm font-black uppercase tracking-wide text-slate-900">{resource.title}</h3>
                <p className="mt-2 flex-1 break-words text-[11px] sm:text-xs leading-relaxed text-slate-500">{resource.description}</p>
                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="mt-3 sm:mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-800">
                  Visit Website <ExternalLink size={13} />
                </a>
                <div className="mt-3 min-w-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-900">
                  <div className="break-words"><span className="font-black uppercase">Username:</span> {resource.username || "Not provided"}</div>
                  <div className="mt-1 break-words"><span className="font-black uppercase">Password:</span> {resource.password || "Not provided"}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
