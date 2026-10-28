export interface Member {
  name: string
  role: string
}

export interface PersonNote {
  id: string
  name: string
  roster: string
  performance: number
  potential: number
  observation: string
  updatedAt: string
}

export interface TalentBoard {
  rosters: Record<string, Member[]>
  people: PersonNote[]
}

export interface PersonInput {
  name: string
  roster: string
  performance: number
  potential: number
  observation: string
}

export interface MemberInput {
  name: string
  role: string
}

export interface DeleteRosterResult {
  deleted: boolean
  removedMembers: number
  removedNotes: number
}
