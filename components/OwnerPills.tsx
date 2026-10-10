const PILL =
  "btn cursor-pointer text-xs has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white";

// Who a new Task is for: Meg (default) / the partner / Felles. Posts as field "owner".
export default function OwnerPills({ members, me }: { members: { user_id: number; name: string }[]; me: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <label className={PILL}>
        <input type="radio" name="owner" value="me" defaultChecked className="sr-only" />
        Meg
      </label>
      {members
        .filter((m) => Number(m.user_id) !== me)
        .map((m) => (
          <label key={m.user_id} className={PILL}>
            <input type="radio" name="owner" value={String(m.user_id)} className="sr-only" />
            {m.name}
          </label>
        ))}
      <label className={PILL}>
        <input type="radio" name="owner" value="felles" className="sr-only" />
        Felles
      </label>
    </div>
  );
}
