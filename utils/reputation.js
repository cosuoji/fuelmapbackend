// src/utils/reputation.js
import { BADGE_DEFS } from "../config/badges.js";
import User from "../models/User.js";


export function computeTrustLevel(reputation) {
  if (reputation >= 200) return "Guardian";
  if (reputation >= 50) return "Trusted";
  if (reputation >= 20) return "Contributor";
  if (reputation >= 5) return "Scout";
  return "Newbie";
}

/**
 * Award a badge to the user object (in-memory), if not already awarded.
 * Returns true if badge added.
 */
function awardBadgeIfMissing(user, key, metadata = {}) {
  if (!BADGE_DEFS[key]) return false;
  if (user.badges.some(b => b.key === key)) return false;
  user.badges.push({
    key,
    name: BADGE_DEFS[key].name,
    description: BADGE_DEFS[key].desc,
    awardedAt: new Date(),
    metadata
  });
  return true;
}

/**
 * Handle updates after a user submits a price.
 * - increments reputation (+1 or +2 if had image)
 * - increments contributions
 * - awards relevant badges
 * - recomputes trust level
 */
export async function handlePostSubmission(userId, { hasImage = false, createdStation = false, adminApproved = false } = {}) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const repChange = hasImage ? 2 : 1;
  user.reputation += repChange;
  user.contributions = (user.contributions || 0) + 1;
  user.reputationHistory.push({ change: repChange, reason: "Price submission", date: new Date() });

  // Badges
  awardBadgeIfMissing(user, "first_submission");
  if (createdStation) awardBadgeIfMissing(user, "station_creator");

  if (user.contributions >= 10) awardBadgeIfMissing(user, "ten_contributions");
  if (user.contributions >= 50) awardBadgeIfMissing(user, "fifty_contributions");

  // if adminApproved is true we give extra rep & verifiedContributions
  if (adminApproved) {
    user.verifiedContributions = (user.verifiedContributions || 0) + 1;
    user.reputation += 2;
    user.reputationHistory.push({ change: 2, reason: "Admin-approved submission", date: new Date() });
    if (user.verifiedContributions >= 5) awardBadgeIfMissing(user, "verified_contributor");
  }

  // trust level
  const newTrust = computeTrustLevel(user.reputation);
  if (user.trustLevel !== newTrust) {
    user.trustLevel = newTrust;
    if (user.reputation >= 500) awardBadgeIfMissing(user, "moderator_candidate");
  }

  await user.save();
  return user;
}

/**
 * Handle admin-approved action (called by admin review route)
 */
export async function handleAdminApproval(userId) {
  return handlePostSubmission(userId, { hasImage: false, adminApproved: true });
}

/**
 * Handle admin rejection (penalize submitter)
 */
export async function handleAdminRejection(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const penalty = 3;
  user.reputation = Math.max(0, user.reputation - penalty);
  user.reputationHistory.push({ change: -penalty, reason: "Admin-rejected submission", date: new Date() });

  // recompute trustLevel
  user.trustLevel = computeTrustLevel(user.reputation);

  await user.save();
  return user;
}
