import { Button, Textarea, cn } from '@eous/ui'
import { BrainCircuit, Paperclip, Send } from 'lucide-react'
import { selectHasIncompleteModelOverride, selectSelectedAgent, useChatStore } from './store'

export function ChatComposer() {
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const agents = useChatStore((state) => state.agents)
  const input = useChatStore((state) => state.input)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const messageCount = useChatStore((state) => state.messages.length)
  const modelInvalid = useChatStore(selectHasIncompleteModelOverride)
  const modelsByProviderId = useChatStore((state) => state.modelsByProviderId)
  const providers = useChatStore((state) => state.providers)
  const selectedAgent = useChatStore(selectSelectedAgent)
  const selectedModelId = useChatStore((state) => state.selectedModelId)
  const selectedProviderId = useChatStore((state) => state.selectedProviderId)
  const selectAgent = useChatStore((state) => state.selectAgent)
  const selectProviderModel = useChatStore((state) => state.selectProviderModel)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const setInput = useChatStore((state) => state.setInput)
  const centered = messageCount === 0
  const disabled = isStreaming || !selectedAgent
  const selectedModelValue =
    selectedProviderId && selectedModelId ? `${selectedProviderId}::${selectedModelId}` : ''

  return (
    <div className={cn('mx-auto w-full max-w-4xl shrink-0 px-5 pb-5', centered && 'pb-[18vh]')}>
      {centered ? (
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </div>
          <h1 className="text-lg font-semibold">Start a new conversation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an agent and model, then send the first message.
          </p>
          <div className="mx-auto mt-4 flex max-w-full flex-wrap justify-center gap-1.5">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className={cn(
                  'h-8 rounded-md border px-3 text-xs font-medium transition-colors',
                  selectedAgent?.id === agent.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => selectAgent(agent.id)}
                disabled={Boolean(activeSessionId)}
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-background shadow-sm">
        {modelInvalid ? (
          <div className="border-b border-border px-3 py-1.5 text-xs text-destructive">
            Select a model for the chosen provider.
          </div>
        ) : null}
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
          className="min-h-20 resize-none border-0 px-3 pt-3 shadow-none focus-visible:ring-0"
          disabled={disabled || modelInvalid}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
          <Button size="sm" variant="ghost-icon" title="Upload attachment">
            <Paperclip className="size-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <select
              className="h-8 max-w-[260px] rounded-md border border-input bg-background px-2 text-xs"
              value={selectedModelValue}
              onChange={(event) => selectProviderModel(event.target.value)}
            >
              {providers.map((provider) => {
                const models = modelsByProviderId[provider.id] ?? []
                if (models.length === 0) return null

                return (
                  <optgroup key={provider.id} label={provider.name}>
                    {models.map((model) => (
                      <option key={model.id} value={`${provider.id}::${model.modelId}`}>
                        {model.displayName ?? model.modelId}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            <Button
              size="sm"
              className="shrink-0 px-3"
              onClick={() => void sendMessage()}
              disabled={!input.trim() || disabled || modelInvalid}
              title="Send"
            >
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
