import { create } from "zustand";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

type State = {
  active: boolean;
  typing: boolean;
  inputDraft: string;
  messages: Message[];
};

type Actions = {
  setActive: (v: boolean) => void;
  setTyping: (v: boolean) => void;
  setInputDraft: (v: string) => void;
  pushMessage: (m: Message) => void;
  appendToken: (id: string, token: string) => void;
  finalizeMessage: (id: string) => void;
  resetConversation: () => void;
};

export const useAppStore = create<State & Actions>((set) => ({
  active: false,
  typing: false,
  inputDraft: "",
  messages: [],

  setActive: (active) => set({ active }),
  setTyping: (typing) => set({ typing }),
  setInputDraft: (inputDraft) => set({ inputDraft }),

  pushMessage: (m) =>
    set((s) => ({ messages: [...s.messages, m] })),

  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m,
      ),
    })),

  finalizeMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, pending: false } : m,
      ),
    })),

  resetConversation: () =>
    set({ messages: [], inputDraft: "", typing: false }),
}));
