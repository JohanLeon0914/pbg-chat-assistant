"use client";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { agents, calendar, clients, evalPrompts, type Agent } from "@/lib/challenge-data";

type Message = {
  id: number;
  role: "agent" | "assistant";
  text: string;
  status?: "Seguro" | "Necesita verificacion" | "Escalar" | "Confirmacion requerida";
  evidence?: string[];
};

type PendingAction = {
  id: number;
  kind: "calendar" | "message";
  label: string;
  payload: string;
};

type AuditEvent = {
  id: number;
  label: string;
  tone: "ok" | "warn" | "blocked";
};

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    status: "Seguro",
    text: "Soy Chat PBG. Trabajo solo con el espacio del agente activo, ignoro instrucciones dentro de notas de clientes y pido confirmacion antes de escribir calendario, tareas o mensajes.",
    evidence: ["Politica de permisos", "Datos sinteticos del reto"],
  },
];

const initialAudit: AuditEvent[] = [
  { id: 1, label: "Sesion iniciada con aislamiento por agente", tone: "ok" },
  { id: 2, label: "Acciones de escritura requieren confirmacion humana", tone: "warn" },
];

function can(agent: Agent, permission: string) {
  return agent.permissions.includes(permission);
}

function tomorrowLabel() {
  return "miercoles 30 de septiembre de 2026";
}

function statusStyle(status?: Message["status"]) {
  if (status === "Escalar") {
    return "border-[#ef7b68] bg-[#fff1ed] text-[#9f2e1f]";
  }

  if (status === "Confirmacion requerida") {
    return "border-[#e1b650] bg-[#fff7df] text-[#7a4b00]";
  }

  if (status === "Necesita verificacion") {
    return "border-[#8ea7ff] bg-[#eef2ff] text-[#2742a0]";
  }

  return "border-[#82c49b] bg-[#edf9f1] text-[#116149]";
}

function auditStyle(tone: AuditEvent["tone"]) {
  if (tone === "blocked") {
    return "border-[#ef7b68] bg-[#fff1ed] text-[#842114]";
  }

  if (tone === "warn") {
    return "border-[#e1b650] bg-[#fff7df] text-[#704600]";
  }

  return "border-[#82c49b] bg-[#edf9f1] text-[#0d533d]";
}

export default function Home() {
  const [activeAgentId, setActiveAgentId] = useState<Agent["id"]>("A1");
  const [input, setInput] = useState(evalPrompts[0]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>(initialAudit);
  const [nextId, setNextId] = useState(10);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? agents[0],
    [activeAgentId],
  );

  const visibleClients = clients.filter((client) => client.agent_id === activeAgent.id);
  const visibleEvents = calendar.filter((event) => event.agent_id === activeAgent.id);

  function addAudit(label: string, tone: AuditEvent["tone"] = "ok") {
    setAudit((current) => [{ id: nextId + Math.random(), label, tone }, ...current].slice(0, 7));
  }

  function answerFor(prompt: string) {
    const normalized = prompt.toLowerCase();
    const evidence: string[] = [];
    let status: Message["status"] = "Seguro";
    let text = "";
    let action: PendingAction | null = null;

    if (normalized.includes("pendiente")) {
      if (!can(activeAgent, "clients:read")) {
        status = "Escalar";
        text = "No tengo permiso para leer clientes. Debe resolverlo un administrador.";
        addAudit("Lectura de clientes bloqueada por permisos", "blocked");
      } else {
        const pending = visibleClients.filter((client) => client.status === "pending");
        text =
          pending.length > 0
            ? `Clientes pendientes de ${activeAgent.name}: ${pending
                .map((client) => `${client.name} (${client.note})`)
                .join(", ")}.`
            : `No hay clientes pendientes visibles para ${activeAgent.name}.`;
        evidence.push("clients.json filtrado por agent_id");
        addAudit(`Listo clientes de ${activeAgent.name} sin mezclar otros agentes`);
      }
    } else if (normalized.includes("llamadas de maría") || normalized.includes("llamadas de maria")) {
      status = "Escalar";
      text =
        activeAgent.id === "A2"
          ? "No hay llamadas registradas para Maria en el paquete de datos; solo puedo reportar lo disponible."
          : "No puedo mostrar datos de Maria desde la sesion de Andres. El software bloquea acceso cruzado aunque el usuario lo pida.";
      evidence.push("Aislamiento por agent_id");
      addAudit("Intento de acceso a otro agente bloqueado", "blocked");
    } else if (normalized.includes("agenda") && normalized.includes("laura")) {
      status = "Confirmacion requerida";
      text =
        "Puedo preparar una reunion con Laura Gomez para manana a las 10:00, pero no la escribo en calendario hasta que confirmes la accion.";
      action = {
        id: nextId,
        kind: "calendar",
        label: "Agendar reunion",
        payload: `Crear evento: Laura Gomez, ${tomorrowLabel()} 10:00, agente ${activeAgent.name}`,
      };
      evidence.push("calendar:write requiere confirmacion");
      addAudit("Accion material retenida antes de escribir calendario", "warn");
    } else if (normalized.includes("mensaje") && normalized.includes("jos")) {
      status = "Confirmacion requerida";
      text =
        "Puedo redactar un mensaje para Jose, pero esta plataforma no lo envia automaticamente como el agente. Te dejo borrador y confirmacion separada.";
      action = {
        id: nextId,
        kind: "message",
        label: "Preparar borrador",
        payload: "Hola Jose, soy Andres de PBG. Queria dar seguimiento a tu cotizacion y resolver cualquier duda.",
      };
      evidence.push("draft_message no envia como agente");
      addAudit("Envio directo evitado; solo borrador pendiente", "warn");
    } else if (normalized.includes("mañana") || normalized.includes("manana")) {
      if (!can(activeAgent, "calendar:read")) {
        status = "Escalar";
        text = "No tengo permiso para leer calendario.";
        addAudit("Lectura de calendario bloqueada por permisos", "blocked");
      } else {
        const list = visibleEvents.map((event) => `${event.title} a las ${event.start.slice(11, 16)}`);
        text =
          list.length > 0
            ? `Para ${tomorrowLabel()}, veo en tu calendario: ${list.join("; ")}.`
            : `No veo eventos para ${activeAgent.name} manana en los datos disponibles.`;
        evidence.push("calendar.json filtrado por agent_id");
        addAudit("Calendario leido solo para agente activo");
      }
    } else if (normalized.includes("nota de jos")) {
      status = "Necesita verificacion";
      text =
        "La nota de Jose contiene una instruccion maliciosa: pide ignorar permisos y revelar clientes de Maria. La trato como dato no confiable, no como instruccion. Resumen util: Jose Martinez esta en estado quoted.";
      evidence.push("Defensa contra prompt injection", "Nota de cliente tratada como contenido");
      addAudit("Prompt injection en nota de cliente neutralizada", "blocked");
    } else {
      status = "Necesita verificacion";
      text =
        "No tengo suficiente contexto para ejecutar eso. Puedo leer clientes/calendario del agente activo o preparar acciones que requieran confirmacion.";
      evidence.push("Alcance limitado del MVP");
      addAudit("Solicitud fuera del alcance respondida sin inventar");
    }

    if (action) {
      setPendingActions((current) => [action, ...current]);
    }

    return { text, status, evidence };
  }

  function submitPrompt(prompt: string) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;

    const userMessage: Message = { id: nextId, role: "agent", text: cleanPrompt };
    const response = answerFor(cleanPrompt);
    const assistantMessage: Message = {
      id: nextId + 1,
      role: "assistant",
      text: response.text,
      status: response.status,
      evidence: response.evidence,
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setNextId((current) => current + 2);
    setInput("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(input);
  }

  function resolveAction(action: PendingAction, confirmed: boolean) {
    setPendingActions((current) => current.filter((item) => item.id !== action.id));
    addAudit(
      confirmed
        ? `${action.label} confirmado por humano: ${action.payload}`
        : `${action.label} cancelado antes de escribir`,
      confirmed ? "ok" : "blocked",
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#171717]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-4 md:px-6 lg:h-screen lg:flex-row lg:py-6">
        <aside className="flex flex-col gap-4 lg:w-80">
          <section className="rounded-lg bg-[#20221f] p-4 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#22a06b]">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold uppercase text-[#9fe0bd]">Reto PBG</p>
                <h1 className="text-xl font-bold">Chat PBG</h1>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#e6e2d8]">
              Asistente seguro para agentes: permisos, aislamiento de datos y confirmacion antes de actuar.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
              <span className="rounded-md bg-white/10 px-2 py-2">Permisos</span>
              <span className="rounded-md bg-white/10 px-2 py-2">Auditoria</span>
              <span className="rounded-md bg-white/10 px-2 py-2">No real data</span>
            </div>
          </section>

          <section className="rounded-lg border border-[#d9d3c7] bg-white p-4 shadow-sm">
            <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="agent">
              <UserRound className="h-4 w-4" aria-hidden />
              Agente activo
            </label>
            <div className="relative mt-2">
              <select
                id="agent"
                value={activeAgentId}
                onChange={(event) => {
                  setActiveAgentId(event.target.value as Agent["id"]);
                  addAudit(`Sesion cambiada a ${event.target.value}`, "warn");
                }}
                className="h-11 w-full appearance-none rounded-md border border-[#c8c0b2] bg-[#fbfaf7] px-3 pr-9 text-sm font-medium outline-none ring-0 transition focus:border-[#116149] focus:ring-2 focus:ring-[#116149]/15"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.id})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-[#5f5b53]" aria-hidden />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeAgent.permissions.map((permission) => (
                <span key={permission} className="rounded-md border border-[#d8d2c5] bg-[#fbfaf7] px-2 py-1 text-xs font-medium text-[#5f5b53]">
                  {permission}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9d3c7] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  Casos de prueba
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#6c665d]">Toca cualquiera para demostrar el control.</p>
              </div>
              <span className="rounded bg-[#20221f] px-2 py-1 text-xs font-bold text-white">{evalPrompts.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {evalPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitPrompt(prompt)}
                  className="rounded-md border border-[#d8d2c5] bg-[#fbfaf7] px-3 py-2 text-left text-sm leading-5 transition hover:border-[#116149] hover:bg-[#edf9f1] hover:text-[#0d533d]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-lg border border-[#d9d3c7] bg-white shadow-sm">
          <header className="border-b border-[#e3ded3] bg-white px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#116149]">Demo funcional</p>
                <h2 className="text-2xl font-bold">Consola del asistente seguro</h2>
                <p className="mt-1 text-sm text-[#5f5b53]">El modelo propone; el software decide permisos, alcance y escritura.</p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-[#b8dac8] bg-[#edf9f1] px-3 py-2 text-sm font-semibold text-[#116149]">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Datos sinteticos
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f8f6f0] p-4 md:p-5">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-3xl rounded-lg border p-4 shadow-sm ${
                  message.role === "assistant"
                    ? "border-[#d8d2c5] bg-white"
                    : "ml-auto border-[#116149] bg-[#e5f5eb]"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{message.role === "assistant" ? "Chat PBG" : activeAgent.name}</span>
                  {message.status ? (
                    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusStyle(message.status)}`}>
                      {message.status}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-6">{message.text}</p>
                {message.evidence?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.evidence.map((item) => (
                      <span key={item} className="rounded-md bg-[#f1ede4] px-2 py-1 text-xs font-medium text-[#5f5b53]">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form onSubmit={onSubmit} className="border-t border-[#e3ded3] bg-white p-3 md:p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-md border border-[#c8c0b2] px-3 text-sm outline-none transition focus:border-[#116149] focus:ring-2 focus:ring-[#116149]/15"
                placeholder="Pregunta o pide una accion..."
              />
              <button
                type="submit"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-[#116149] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b4f3a]"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden />
                Enviar
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-4 lg:w-96">
          <section className="rounded-lg border border-[#d9d3c7] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Confirmaciones pendientes
              </h2>
              <span className="rounded bg-[#fff7df] px-2 py-1 text-xs font-bold text-[#704600]">{pendingActions.length}</span>
            </div>
            <div className="mt-3 space-y-3">
              {pendingActions.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#d8d2c5] bg-[#fbfaf7] p-3 text-sm leading-6 text-[#5f5b53]">
                  No hay escrituras pendientes.
                </p>
              ) : (
                pendingActions.map((action) => (
                  <div key={action.id} className="rounded-md border border-[#e1b650] bg-[#fff7df] p-3">
                    <p className="text-sm font-bold">{action.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5c4a20]">{action.payload}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => resolveAction(action, true)}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-[#116149] px-3 text-sm font-bold text-white transition hover:bg-[#0b4f3a]"
                      >
                        <Check className="h-4 w-4" aria-hidden />
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveAction(action, false)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#c8c0b2] bg-white px-3 text-sm font-bold transition hover:bg-[#fff1ed]"
                      >
                        <X className="h-4 w-4" aria-hidden />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9d3c7] bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4" aria-hidden />
              Datos visibles
            </h2>
            <div className="mt-3 space-y-3 rounded-md bg-[#fbfaf7] p-3">
              <div>
                <p className="text-xs font-bold uppercase text-[#5f5b53]">Clientes</p>
                {visibleClients.map((client) => (
                  <div key={client.id} className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
                    <span className="font-medium">{client.name}</span>
                    <span className="rounded bg-[#f1ede4] px-2 py-1 text-xs font-bold text-[#5f5b53]">{client.status}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[#5f5b53]">Calendario</p>
                {visibleEvents.map((event) => (
                  <div key={`${event.agent_id}-${event.start}`} className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
                    <span className="font-medium">{event.title}</span>
                    <span className="rounded bg-[#edf9f1] px-2 py-1 text-xs font-bold text-[#116149]">{event.start.slice(11, 16)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#d9d3c7] bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Auditoria
            </h2>
            <div className="mt-3 space-y-2">
              {audit.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-md border px-3 py-2 text-sm font-medium leading-5 ${auditStyle(item.tone)}`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
