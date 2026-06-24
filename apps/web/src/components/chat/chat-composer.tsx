import { Button, Textarea, cn } from '@eous/ui'
import { BrainCircuit, Send } from 'lucide-react'
import { selectHasIncompleteModelOverride, selectSelectedAgent, useChatStore } from './store'

export function ChatComposer() {
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const agents = useChatStore((state) => state.agents)
  const input = useChatStore((state) => state.input)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const messageCount = useChatStore((state) => state.messages.length)
  const modelInvalid = useChatStore(selectHasIncompleteModelOverride)
  const models = useChatStore((state) => state.models)
  const providers = useChatStore((state) => state.providers)
  const selectedAgent = useChatStore(selectSelectedAgent)
  const selectedModelId = useChatStore((state) => state.selectedModelId)
  const selectedProviderId = useChatStore((state) => state.selectedProviderId)
  const selectAgent = useChatStore((state) => state.selectAgent)
  const selectProvider = useChatStore((state) => state.selectProvider)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const setInput = useChatStore((state) => state.setInput)
  const setSelectedModelId = useChatStore((state) => state.setSelectedModelId)
  const centered = messageCount === 0
  const disabled = isStreaming || !selectedAgent

  return (
    <div className={cn('shrink-0 px-5 pb-5', centered && 'w-full max-w-3xl self-center pb-[18vh]')}>
      {centered ? (
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </div>
          <h1 className="text-lg font-semibold">Start a new conversation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an agent and model, then send the first message.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-background shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-border p-2">
          <select
            className="h-8 min-w-40 rounded-md border border-input bg-background px-2 text-xs"
            value={selectedAgent?.id ?? ''}
            onChange={(event) => selectAgent(event.target.value)}
            disabled={Boolean(activeSessionId)}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <select
            className="h-8 min-w-40 rounded-md border border-input bg-background px-2 text-xs"
            value={selectedProviderId}
            onChange={(event) => selectProvider(event.target.value)}
          >
            <option value="">Agent default provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <select
            className="h-8 min-w-48 rounded-md border border-input bg-background px-2 text-xs"
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
            disabled={!selectedProviderId}
          >
            <option value="">Agent default model</option>
            {models.map((model) => (
              <option key={model.id} value={model.modelId}>
                {model.displayName ?? model.modelId}
              </option>
            ))}
          </select>
        </div>
        {modelInvalid ? (
          <div className="border-b border-border px-3 py-1.5 text-xs text-destructive">
            Select a model for the chosen provider.
          </div>
        ) : null}
        <div className="flex gap-2 p-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            placeholder="Ask about a symbol, workflow, market setup, or analysis task..."
            className="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
            disabled={disabled || modelInvalid}
          />
          <Button
            className="h-16 px-3"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || disabled || modelInvalid}
            title="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
