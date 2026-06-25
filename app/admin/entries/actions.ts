"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { entries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recomputeChips } from "@/lib/chips/recompute";
import type { NewEntryChip } from "@/db/schema";

interface UpdateEntryInput {
  entryId: number;
  title: string;
  bodyMd: string;
  chips?: Omit<NewEntryChip, "entry_id">[];
}

export async function updateEntry(input: UpdateEntryInput) {
  const { entryId, title, bodyMd, chips } = input;

  await db
    .update(entries)
    .set({ title, body_md: bodyMd, updated_at: new Date() })
    .where(eq(entries.id, entryId));

  if (chips !== undefined) {
    await recomputeChips(entryId, chips);
  }
}

export async function publishEntry(entryId: number) {
  const [updated] = await db
    .update(entries)
    .set({
      is_published: true,
      published_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(entries.id, entryId))
    .returning({ slug: entries.slug });

  if (!updated) throw new Error("Entry not found");

  // Immediate ISR + data cache invalidation on publish
  revalidateTag("entries", "max");
  revalidatePath("/");
  revalidatePath(`/entries/${updated.slug}`);
  revalidatePath("/rss.xml");

  return { slug: updated.slug };
}

export async function unpublishEntry(entryId: number) {
  const [updated] = await db
    .update(entries)
    .set({ is_published: false, updated_at: new Date() })
    .where(eq(entries.id, entryId))
    .returning({ slug: entries.slug });

  if (!updated) throw new Error("Entry not found");

  revalidateTag("entries", "max");
  revalidatePath("/");
  revalidatePath(`/entries/${updated.slug}`);
  revalidatePath("/rss.xml");
}
