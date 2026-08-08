import { redirect } from "next/navigation";

/**
 * OPS has one destination now, and it is the task list.
 *
 * This route used to be the morning brief: four pipeline tiles over the `ops`
 * chat surface. Daniyal's call is that the module shows tasks and nothing
 * else, so the screen is gone.
 *
 * A redirect rather than a deletion, deliberately. `/ops` is the module's
 * front door, it is in the notification hrefs written before today, and it is
 * the kind of URL people bookmark. PLS-80 let `/content/skills` 404 on purpose
 * because that feature moved into a popup on another screen and a stale
 * bookmark had somewhere wrong to land; here there is exactly one right
 * answer, so sending people to it beats showing them a 404.
 */
export default async function OpsPage() {
  redirect("/ops/tasks");
}
