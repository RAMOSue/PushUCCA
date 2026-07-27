const STORAGE_KEY = "inventory_division_assignments";

function readAssignments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("Unable to read inventory division assignments", error);
    return {};
  }
}

function writeAssignments(assignments) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch (error) {
    console.warn("Unable to persist inventory division assignments", error);
  }
}

function normalizeItemKey(itemLike) {
  if (!itemLike && itemLike !== 0) return null;

  if (typeof itemLike === "object") {
    return (
      itemLike.uuid ||
      itemLike.id ||
      itemLike.item_uuid ||
      itemLike.itemId ||
      itemLike.item_id ||
      itemLike.id ||
      null
    );
  }

  return String(itemLike);
}

export function getInventoryDivisionInfo(itemLike) {
  const key = normalizeItemKey(itemLike);
  if (!key) return null;

  const assignments = readAssignments();
  const assignment = assignments[key];
  if (!assignment) return null;

  return {
    division_id: assignment.division_id ?? assignment.id ?? null,
    division_name: assignment.division_name ?? assignment.name ?? null,
  };
}

export function setInventoryDivisionAssignment(itemLike, division) {
  const key = normalizeItemKey(itemLike);
  if (!key || !division) return null;

  const assignments = readAssignments();
  assignments[key] = {
    division_id: division.division_id ?? division.id ?? null,
    division_name: division.division_name ?? division.name ?? null,
  };

  writeAssignments(assignments);
  return assignments[key];
}

export function clearInventoryDivisionAssignment(itemLike) {
  const key = normalizeItemKey(itemLike);
  if (!key) return;

  const assignments = readAssignments();
  delete assignments[key];
  writeAssignments(assignments);
}
