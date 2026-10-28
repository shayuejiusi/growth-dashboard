import { api } from "@/lib/api/client"
import type { DeleteRosterResult, Member, MemberInput, PersonInput, PersonNote, TalentBoard } from "./types"

export const talentKeys = {
  all: ["talent"] as const,
  board: () => [...talentKeys.all, "board"] as const,
}

export function getTalentBoard(signal?: AbortSignal) {
  return api<TalentBoard>("/api/talent", { signal })
}

export function createPerson(input: PersonInput) {
  return api<PersonNote>("/api/talent/people", { method: "POST", body: input })
}

export function updatePerson(id: string, input: PersonInput) {
  return api<PersonNote>(`/api/talent/people/${encodeURIComponent(id)}`, { method: "PUT", body: input })
}

export function deletePerson(id: string) {
  return api<{ deleted: boolean }>(`/api/talent/people/${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function createRoster(name: string) {
  return api<string[]>("/api/talent/rosters", { method: "POST", body: { name } })
}

export function deleteRoster(roster: string) {
  return api<DeleteRosterResult>(`/api/talent/rosters/${encodeURIComponent(roster)}`, { method: "DELETE" })
}

export function addRosterMember(roster: string, input: MemberInput) {
  return api<Member[]>(`/api/talent/rosters/${encodeURIComponent(roster)}/members`, { method: "POST", body: input })
}

export function updateRosterMember(roster: string, name: string, input: MemberInput) {
  return api<Member>(`/api/talent/rosters/${encodeURIComponent(roster)}/members/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: input,
  })
}

export function deleteRosterMember(roster: string, name: string) {
  return api<{ deleted: boolean; removedNotes: number }>(
    `/api/talent/rosters/${encodeURIComponent(roster)}/members/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  )
}
