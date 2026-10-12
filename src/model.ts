export type Kind = "course" | "folder" | "note" | "exam";
export type Item = {
  id: string;
  parent_id: string | null;
  kind: Kind;
  title: string;
  content: string;
  color: string;
  due_date: string;
  done: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};
export type Activity = {
  id: string;
  action: string;
  title: string;
  node_id: string | null;
  actor: string;
  created_at: string;
};
export type State = {
  nodes: Item[];
  activity: Activity[];
  name: string;
  api_enabled: boolean;
};
export type Auth = {
  authenticated: boolean;
  setup_required: boolean;
  name: string;
  local_mode: boolean;
};
