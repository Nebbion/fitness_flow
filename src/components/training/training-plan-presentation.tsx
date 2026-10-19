type ExerciseImage = { path: string; alt?: string; url?: string }

export function ExerciseGallery({ images, name, printable = false }: { images?: ExerciseImage[]; name: string; printable?: boolean }) {
  const visible = (images ?? []).filter(image => image.url)
  if (!visible.length) return null
  return <div className={`mt-3 grid gap-2 ${visible.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
    {visible.map(image => <figure key={image.path} className="break-inside-avoid overflow-hidden rounded-md border border-border bg-white">
      <img src={image.url} alt={image.alt || `Esecuzione ${name}`} className={`w-full object-contain ${printable ? 'h-36' : 'max-h-64'}`} />
      {image.alt && <figcaption className="border-t px-2 py-1 text-[10px] text-muted-foreground">{image.alt}</figcaption>}
    </figure>)}
  </div>
}

export function PrintableTrainingPlan({
  tenant,
  client,
  exercises,
  title,
}: {
  tenant: { name: string; logo_url?: string | null }
  client: { full_name: string }
  exercises: any[]
  title: string
}) {
  return <section className="hidden bg-white text-black print:block">
    <header className="flex items-center gap-4 border-b-2 border-black pb-4">
      {tenant.logo_url && <img src={tenant.logo_url} alt={tenant.name} className="h-16 w-16 object-contain" />}
      <div className="flex-1"><p className="text-sm font-semibold">{tenant.name}</p><h1 className="mt-1 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm">Cliente: {client.full_name}</p></div>
    </header>
    <div className="mt-5 space-y-5">
      {exercises.map((exercise, index) => <article key={exercise.id} className="break-inside-avoid border-b border-zinc-300 pb-5">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase">Esercizio {index + 1}</p>
          <h2 className="mt-1 text-lg font-bold">{exercise.name}</h2></div>
          <p className="text-sm"><strong>{exercise.targetSets}</strong> serie · <strong>{exercise.targetReps}</strong> ripetizioni</p></div>
        {exercise.notes && <p className="mt-2 text-sm">{exercise.notes}</p>}
        {exercise.targetWeightKg != null && <p className="mt-2 text-sm">Carico consigliato: {exercise.targetWeightKg} kg</p>}
        <ExerciseGallery images={exercise.images} name={exercise.name} printable />
        <table className="mt-3 w-full border-collapse text-xs"><thead><tr>
          <th className="border border-zinc-400 p-1 text-left">Serie</th><th className="border border-zinc-400 p-1 text-left">Ripetizioni</th>
          <th className="border border-zinc-400 p-1 text-left">Carico</th><th className="border border-zinc-400 p-1 text-left">Note</th>
        </tr></thead><tbody>{Array.from({ length: exercise.targetSets }, (_, row) => <tr key={row}>
          <td className="border border-zinc-300 p-2">{row + 1}</td><td className="border border-zinc-300 p-2" />
          <td className="border border-zinc-300 p-2" /><td className="border border-zinc-300 p-2" />
        </tr>)}</tbody></table>
      </article>)}
    </div>
  </section>
}
