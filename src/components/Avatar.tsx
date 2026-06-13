/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface AvatarUser {
  fullName: string;
  avatarColor: string;
  avatarImage?: string;
}

interface AvatarProps {
  user: AvatarUser;
  /** Sizing / rounding utility classes, e.g. "size-8 rounded-full". */
  className?: string;
  /** Extra classes (e.g. "shrink-0"). */
  extraClass?: string;
}

/**
 * Renders a user's custom avatar image when available, otherwise falls back
 * to the first letter on a colored background. Used everywhere an avatar shows.
 */
export function Avatar({ user, className = "w-8.5 h-8.5 rounded-xl text-sm", extraClass = "" }: AvatarProps) {
  const frameClass = `aspect-square shrink-0 overflow-hidden ${className} ${extraClass}`;
  const initial = (user.fullName.trim().charAt(0) || "?").toUpperCase();

  if (user.avatarImage) {
    return (
      <img
        src={user.avatarImage}
        alt={user.fullName}
        referrerPolicy="no-referrer"
        className={`object-cover ${frameClass}`}
      />
    );
  }

  return (
    <div className={`${user.avatarColor} text-slate-950 font-bold flex items-center justify-center leading-none select-none ${frameClass}`}>
      {initial}
    </div>
  );
}
