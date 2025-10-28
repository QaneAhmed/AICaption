import CaptionCoachForm from "@/components/caption-coach-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f8fb] px-4 py-16 font-sans text-zinc-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 rounded-3xl bg-white p-8 shadow-sm sm:p-12">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase text-[#6c5ce7]">
            AI Caption Coach
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Draft scroll-stopping captions or polished bios in seconds.
          </h1>
          <p className="text-base text-zinc-600">
            Upload a photo for tailored captions, or switch to Bio mode and let
            your words lead the way. Guidance text helps the coach nail the
            details.
          </p>
        </header>

        <section>
          <CaptionCoachForm />
        </section>
      </div>
    </main>
  );
}
