// One list of shapes, whichever side they came from.
//
// The five built-ins live in code because they are the product's opinion about
// what a recruiter's post should do, and they must exist for an org that has
// added nothing. Custom shapes live in content_shapes. Everything downstream
// wants a single list, so the merge happens here rather than in four screens.
import { SKILLS } from "@/config/content-skills";
import type { ContentShapeRow, PostRow, Shape } from "@/lib/supabase/types";

export const BUILT_IN_SHAPES: Shape[] = SKILLS.map((skill) => ({
  // Null id is the flag that says "built in", which is exactly what decides
  // whether a post carries shape_id or falls back to its skill column.
  id: null,
  key: skill.key,
  name: skill.name,
  blurb: skill.blurb,
  prompt: skill.prompt,
}));

export function allShapes(custom: ContentShapeRow[]): Shape[] {
  return [
    ...BUILT_IN_SHAPES,
    ...custom.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      blurb: row.blurb,
      prompt: row.prompt,
    })),
  ];
}

/**
 * The shape a post was written through.
 *
 * A post points at a custom shape by id and at a built-in by its skill column,
 * and a deleted custom shape nulls the id. Falling back to the skill keeps a
 * post readable rather than showing a blank where its shape used to be.
 */
export function shapeForPost(post: PostRow, shapes: Shape[]): Shape {
  if (post.shape_id) {
    const custom = shapes.find((s) => s.id === post.shape_id);
    if (custom) return custom;
  }
  return (
    shapes.find((s) => s.id === null && s.key === post.skill) ??
    BUILT_IN_SHAPES[0]
  );
}

/** A stable key for a shape, used as a select value across both kinds. */
export function shapeValue(shape: Shape): string {
  return shape.id ?? `builtin:${shape.key}`;
}

export function shapeFromValue(value: string, shapes: Shape[]): Shape | null {
  if (value.startsWith("builtin:")) {
    const key = value.slice("builtin:".length);
    return shapes.find((s) => s.id === null && s.key === key) ?? null;
  }
  return shapes.find((s) => s.id === value) ?? null;
}
