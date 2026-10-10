import "server-only";
import { dbBatch } from "./db";
import { assertHomeMember, listChores } from "./home";
import { cadencePoints, type Cadence } from "./home-cadence";

type Seed = { title: string; area: string; cadence: Cadence; note?: string; rotating?: boolean };

// The "Vårt hjem – ansvar og rutiner" starter set, faithful to the document.
// conditional notes stay in Norwegian (that's how the couple phrased them).
const STARTER: Seed[] = [
  // 2. Daglig drift
  { title: "Ta ut søppel (rest, plast)", area: "Avfall", cadence: "daily" },
  { title: "Tømme/fylle oppvaskmaskin", area: "Kjøkken", cadence: "daily" },
  { title: "Fylle på vann i renser", area: "Kjøkken", cadence: "daily" },
  { title: "Kaste flasker/glass i spesialavfall", area: "Avfall", cadence: "daily" },
  { title: "Kaste papp/papir", area: "Avfall", cadence: "daily" },
  { title: "Gå med pant", area: "Avfall", cadence: "daily" },
  { title: "Stelle planter", area: "Hjem", cadence: "daily" },
  { title: "Tørke kjøkkenbenken + vaske oppvaskkum før sengetid", area: "Kjøkken", cadence: "daily", note: "Den som lagde mat" },
  { title: "Tørke av dosetet etter dusj (hvis hår)", area: "Bad", cadence: "daily", note: "Den som dusjet" },
  { title: "Vaske/tørke trefjøla etter bruk", area: "Kjøkken", cadence: "daily", note: "Den som brukte den" },
  { title: "Ta inn puter fra balkongen", area: "Balkong", cadence: "daily", note: "Den som tok dem ut" },
  // 3. Ukentlig
  { title: "Klesvask – farger og hvitt hver for seg, tøymykner", area: "Klesvask", cadence: "weekly" },
  { title: "Henge opp tøy etter vask", area: "Klesvask", cadence: "weekly" },
  { title: "Ta ned tørket tøy fra stativ", area: "Klesvask", cadence: "weekly" },
  { title: "Vaske do mellom hovedvask", area: "Bad", cadence: "weekly" },
  { title: "Rydde gammel mat i kjøleskap, bruke restene", area: "Kjøkken", cadence: "weekly" },
  { title: "Planlegge ukens middager", area: "Kjøkken", cadence: "weekly", rotating: true },
  // Annenhver uke
  { title: "Vaske håndklær", area: "Klesvask", cadence: "biweekly" },
  { title: "Bytte ut kjøkkenhåndklær", area: "Kjøkken", cadence: "biweekly" },
  // 4. Månedlig
  { title: "Vaske kjøleskap innvendig", area: "Kjøkken", cadence: "monthly" },
  { title: "Vaske yogamatte", area: "Hjem", cadence: "monthly" },
  // 5. Kvartalsvis
  { title: "Vaske gulv", area: "Hjem", cadence: "quarterly" },
  { title: "Vaske mikro", area: "Kjøkken", cadence: "quarterly" },
  { title: "Vaske oppvaskmaskin (filter, maskinrens)", area: "Kjøkken", cadence: "quarterly" },
  { title: "Vaske kjøkkenvifte over komfyr", area: "Kjøkken", cadence: "quarterly" },
  { title: "Fjerne vann i bunn av kjøleskap", area: "Kjøkken", cadence: "quarterly" },
  // 6. Halvårlig
  { title: "Vaske vinduer (inne og ute)", area: "Hjem", cadence: "semiannual" },
  { title: "Vaske vaskemaskin", area: "Klesvask", cadence: "semiannual" },
  { title: "Vaske balkong", area: "Balkong", cadence: "semiannual" },
  { title: "Skrubbe/vaske dusjen", area: "Bad", cadence: "semiannual" },
  { title: "Sortere, rydde og vaske/støvsuge kjøkkenskap", area: "Kjøkken", cadence: "semiannual" },
  { title: "Gå gjennom fryser", area: "Kjøkken", cadence: "semiannual" },
  // 7. Årlig / sesong
  { title: "Vaske inni komfyr", area: "Kjøkken", cadence: "annual" },
  { title: "Defroste fryser", area: "Kjøkken", cadence: "annual" },
  { title: "Stelle balkongblomster", area: "Balkong", cadence: "seasonal" },
  { title: "Pakke ned balkongen for sesongen", area: "Balkong", cadence: "seasonal" },
  { title: "Holde orden i hjørneskap (kjeler og diverse)", area: "Kjøkken", cadence: "seasonal" },
];

// Insert the starter set, but only if the home has no chores yet (idempotent).
export async function seedStarter(homeId: number, userId: number): Promise<number> {
  await assertHomeMember(homeId, userId);
  if ((await listChores(homeId)).length > 0) return 0;
  const sql = `INSERT INTO chores (home_id, title, area, cadence, points, rotating, conditional_note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`;
  await dbBatch(
    STARTER.map((r) => ({
      sql,
      args: [homeId, r.title, r.area, r.cadence, cadencePoints(r.cadence), r.rotating ? 1 : 0, r.note ?? null],
    })),
  );
  return STARTER.length;
}
