import type { ElementType, ReactNode } from "react";

/**
 * PLS-178. A surface at one of four levels.
 *
 * The Figma handoff's first line is "depth is a token layer, not a per-screen
 * decision", and this component is that sentence. Before it, every card picked
 * its own fill and border and none of them picked a shadow, which is why the
 * product read flat: not because any one screen was wrong, but because there
 * was nothing to inherit.
 *
 * Fill, border and elevation arrive together and cannot be mixed by hand.
 * That coupling is the point. DESIGN.md 6z:
 *
 *   - raised surfaces get a hairline border; sunken wells get none and recede
 *     by fill alone
 *   - never apply elevation to a sunken surface
 *   - at most two floating layers on screen at once
 *
 * The inset white top highlight on raised levels is the detail most
 * responsible for something reading as lit from above, and it is the one
 * people leave out.
 */

export type SurfaceLevel = 0 | 1 | 2 | 3;

const LEVELS: Record<SurfaceLevel, string> = {
  // 0: the page canvas. No border, no shadow, nothing to lift.
  0: "bg-paper",
  // 1: SUNKEN. Kanban columns, inputs, control beds. No border and no
  //    elevation by rule: it recedes by fill, and a well with a drop shadow
  //    is a contradiction the eye catches before the mind does.
  1: "bg-well",
  // 2: RAISED. Cards, metric tiles, post cards, candidate cards. The common
  //    case, and the one that carries the highlight.
  2: "bg-sheet border border-rule raised",
  // 3: FLOATING. Popovers, drawers, dragged items only. Opaque, always:
  //    DESIGN.md 6c, elevation says "in front", never transparency.
  3: "bg-float border border-rule shadow-elev-4",
};

export function Surface({
  level = 2,
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: {
  level?: SurfaceLevel;
  /** section, article, li, aside. Defaults to div. */
  as?: ElementType;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag className={`${LEVELS[level]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
