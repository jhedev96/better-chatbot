"use client";

import {
  AudioWaveformIcon,
  ChevronDown,
  CornerRightUp,
  LightbulbIcon,
  PlusIcon,
  Square,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, ReactNode } from "react";
import { Button } from "ui/button";
import { notImplementedToast } from "ui/shared-toast";
import { UseChatHelpers } from "@ai-sdk/react";
import { SelectModel } from "./select-model";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ChatMention, ChatModel } from "app-types/chat";
import dynamic from "next/dynamic";
import { ToolModeDropdown } from "./tool-mode-dropdown";

import { ToolSelectDropdown } from "./tool-select-dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { useTranslations } from "next-intl";
import { Editor } from "@tiptap/react";
import { WorkflowSummary } from "app-types/workflow";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import equal from "lib/equal";
import { MCPIcon } from "ui/mcp-icon";
import { DefaultToolName } from "lib/ai/tools";
import { DefaultToolIcon } from "./default-tool-icon";
import { OpenAIIcon } from "ui/openai-icon";
import { GrokIcon } from "ui/grok-icon";
import { ClaudeIcon } from "ui/claude-icon";
import { GeminiIcon } from "ui/gemini-icon";
import { cn } from "lib/utils";
import { getShortcutKeyList, isShortcutEvent } from "lib/keyboard-shortcuts";
import { Agent } from "app-types/agent";
import { EMOJI_DATA } from "lib/const";

import { PeekElement } from "ui/peek-element";

// Interface definition remains the same
interface PromptInputProps {
  placeholder?: string;
  setInput: (value: string) => void;
  input: string;
  onStop: () => void;
  append: UseChatHelpers["append"];
  toolDisabled?: boolean;
  isLoading?: boolean;
  model?: ChatModel;
  onThinkingChange?: (thinking: boolean) => void;
  thinking?: boolean;
  setModel?: (model: ChatModel) => void;
  voiceDisabled?: boolean;
  threadId?: string;
  disabledMention?: boolean;
  onFocus?: () => void;
  isThreadActive?: boolean;
  scrollableContainerRef?: React.RefObject<HTMLElement | null>;
}

const ChatMentionInput = dynamic(() => import("./chat-mention-input"), {
  ssr: false,
  loading() {
    return <div className="h-[2rem] w-full animate-pulse"></div>;
  },
});

const THINKING_SHORTCUT = {
  shortcut: {
    command: true,
    key: "E",
  },
};

/**
 * A conditional wrapper component.
 * It wraps its children with PeekElement only when the thread is active.
 */
const PromptContainer = ({
  isThreadActive,
  promptPeekActive,
  children,
  scrollableContainerRef, // MODIFICATION: Terima ref
}: {
  isThreadActive?: boolean;
  promptPeekActive?: boolean;
  children: ReactNode;
  scrollableContainerRef?: React.RefObject<HTMLElement | null>; // MODIFICATION: Tambahkan tipe
}) => {
  if (isThreadActive && promptPeekActive) {
    return (
      <PeekElement
        // MODIFICATION: Teruskan ref ke PeekElement
        scrollableContainerRef={scrollableContainerRef}
        config={{
          behavior: "slide",
          hideOnScrollUp: false,
          position: "bottom",
          //scrollThreshold: 60,
          parentProps: { style: { bottom: 0 } },
          childProps: { style: { bottom: 0 } },
          placeHolderProps: { style: { bottom: 0 } }
        }}
      >
        {children}
      </PeekElement>
    );
  }
  // If the thread is not active, just render the children without the PeekElement wrapper.
  return <>{children}</>;
};

export default function PromptInput({
  placeholder,
  append,
  model,
  setModel,
  input,
  onFocus,
  setInput,
  onStop,
  isLoading,
  toolDisabled,
  voiceDisabled,
  threadId,
  onThinkingChange,
  thinking,
  disabledMention,
  isThreadActive,
  scrollableContainerRef,
}: PromptInputProps) {
  const t = useTranslations("Chat");

  const [globalModel, threadMentions, appStoreMutate] = appStore(
    useShallow((state) => [
      state.chatModel,
      state.threadMentions,
      state.mutate,
    ]),
  );

  const mentions = useMemo<ChatMention[]>(() => {
    if (!threadId) return [];
    return threadMentions[threadId!] ?? [];
  }, [threadMentions, threadId]);

  const chatModel = useMemo(() => {
    return model ?? globalModel;
  }, [model, globalModel]);

  const editorRef = useRef<Editor | null>(null);

  // All hooks (useCallback, useEffect) remain the same...
  const setChatModel = useCallback(
    (model: ChatModel) => {
      if (setModel) {
        setModel(model);
      } else {
        appStoreMutate({ chatModel: model });
      }
    },
    [setModel, appStoreMutate],
  );

  const deleteMention = useCallback(
    (mention: ChatMention) => {
      if (!threadId) return;
      appStoreMutate((prev) => {
        const newMentions = mentions.filter((m) => !equal(m, mention));
        return {
          threadMentions: {
            ...prev.threadMentions,
            [threadId!]: newMentions,
          },
        };
      });
    },
    [mentions, threadId, appStoreMutate],
  );

  const addMention = useCallback(
    (mention: ChatMention) => {
      if (!threadId) return;
      appStoreMutate((prev) => {
        if (mentions.some((m) => equal(m, mention))) return prev;

        const newMentions =
          mention.type == "agent"
            ? [...mentions.filter((m) => m.type !== "agent"), mention]
            : [...mentions, mention];

        return {
          threadMentions: {
            ...prev.threadMentions,
            [threadId!]: newMentions,
          },
        };
      });
    },
    [mentions, threadId, appStoreMutate],
  );

  const onSelectWorkflow = useCallback(
    (workflow: WorkflowSummary) => {
      addMention({
        type: "workflow",
        name: workflow.name,
        icon: workflow.icon,
        workflowId: workflow.id,
        description: workflow.description,
      });
    },
    [addMention],
  );

  const onSelectAgent = useCallback(
    (agent: Omit<Agent, "createdAt" | "updatedAt" | "instructions">) => {
      appStoreMutate((prev) => {
        return {
          threadMentions: {
            ...prev.threadMentions,
            [threadId!]: [
              {
                type: "agent",
                name: agent.name,
                icon: agent.icon,
                description: agent.description,
                agentId: agent.id,
              },
            ],
          },
        };
      });
    },
    [threadId, appStoreMutate],
  );

  const onChangeMention = useCallback(
    (mentions: ChatMention[]) => {
      let hasAgent = false;
      [...mentions]
        .reverse()
        .filter((m) => {
          if (m.type == "agent") {
            if (hasAgent) return false;
            hasAgent = true;
          }

          return true;
        })
        .reverse()
        .forEach(addMention);
    },
    [addMention],
  );

  const submit = () => {
    if (isLoading) return;
    const userMessage = input?.trim() || "";
    if (userMessage.length === 0) return;
    setInput("");
    append!({
      role: "user",
      content: "",
      parts: [
        {
          type: "text",
          text: userMessage,
        },
      ],
    });
  };

  useEffect(() => {
    if (!onThinkingChange) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcutEvent(e, THINKING_SHORTCUT)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onThinkingChange(!thinking);
        editorRef.current?.commands.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onThinkingChange, thinking]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mentions.length > 0 && threadId) {
        e.preventDefault();
        e.stopPropagation();
        appStoreMutate((prev) => ({
          threadMentions: {
            ...prev.threadMentions,
            [threadId]: [],
          },
          agentId: undefined,
        }));
        editorRef.current?.commands.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mentions.length, threadId, appStoreMutate]);

  useEffect(() => {
    if (!editorRef.current) return;
  }, [editorRef.current]);

  return (
    <>
      {/* CSS for the glowing border effect */}
      <style>{`
        @keyframes rotate {
          100% {
            transform: translate(-50%, -50%) rotate(1turn);
          }
        }
        
        .prompt-border-wrapper {
          position: relative;
          overflow: hidden;
          z-index: 1;
        }

        /* The spinning gradient for the border */
        .prompt-border-wrapper::before {
          content: '';
          position: absolute;
          z-index: -2;
          left: 50%;
          top: 50%;
          width: 150%;
          padding-bottom: 150%;
          transform: translate(-50%, -50%);
          background-image: conic-gradient(rgba(0,0,0,0), #1976ed, #FF33A1, #33FF57, rgba(0,0,0,0) 50%);
          animation: rotate 4s linear infinite;
        }

        /* The blurred glow effect */
        .prompt-border-wrapper::after {
          content: '';
          position: absolute;
          z-index: -1;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background: inherit;
          filter: blur(20px);
        }
      `}</style>
      <PromptContainer 
        isThreadActive={isThreadActive}
        promptPeekActive="false"
        scrollableContainerRef={scrollableContainerRef} // MODIFICATION: Teruskan ref ke container
      >
      <div className="max-w-3xl mx-auto fade-in animate-in">
        {/* This is the main wrapper. 
          - When the thread is NOT active, it has the glowing border effect.
          - When the thread IS active, it acts as the background for the "rounded-out" effect.
        */}
        <div
          className={cn(
            "p-[1.5px]", // Padding creates the border thickness
            !isThreadActive && "prompt-border-wrapper rounded-4xl", // Inactive state: glowing border with full rounding
            isThreadActive && "bg-transparent rounded-t-4xl", // Active state: static background color for the cutout effect
            
            isThreadActive && "border-t border-l border-r border-b border-border pt-1 px-1 pb-1"
          )}
        >
          {/* This is the inner content block. It has a solid background to cover the wrapper's gradient/color,
            creating the main input area.
          */}
          <div
            className={cn(
              "w-full bg-background z-10 mx-auto max-w-3xl relative",
              // The key change: Apply `rounded-out` here.
              // It cuts into the parent div's background (`bg-border` when active).
              isThreadActive && "bg-muted overflow-hidden rounded-out-b-3xl rounded-t-4xl",
              !isThreadActive && "rounded-4xl"
            )}
          >
            <fieldset className="flex w-full min-w-0 max-w-full flex-col px-0 pb-0">
              <div
                className={cn(
                  "shadow-lg overflow-hidden backdrop-blur-sm transition-all duration-200 bg-muted/60 relative flex w-full flex-col cursor-text z-10 items-stretch focus-within:bg-muted hover:bg-muted focus-within:ring-muted hover:ring-muted",
                  // Match the rounding of the direct parent.
                  isThreadActive && "rounded-t-3xl",
                  !isThreadActive && "rounded-4xl"
                )}
              >
                {mentions.length > 0 && (
                  <div className="bg-input rounded-t-3xl p-3 flex flex-col gap-4 mx-2 mt-2">
                    {mentions.map((mention, i) => {
                      return (
                        <div key={i} className="flex items-center gap-2">
                          {mention.type === "workflow" ||
                          mention.type === "agent" ? (
                            <Avatar
                              className="size-6 p-1 ring ring-border rounded-full flex-shrink-0"
                              style={mention.icon?.style}
                            >
                              <AvatarImage
                                src={
                                  mention.icon?.value ||
                                  EMOJI_DATA[i % EMOJI_DATA.length]
                                }
                              />
                              <AvatarFallback>
                                {mention.name.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <Button className="size-6 flex items-center justify-center ring ring-border rounded-full flex-shrink-0 p-0.5">
                              {mention.type == "mcpServer" ? (
                                <MCPIcon className="size-3.5" />
                              ) : (
                                <DefaultToolIcon
                                  name={mention.name as DefaultToolName}
                                  className="size-3.5"
                                />
                              )}
                            </Button>
                          )}

                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-semibold truncate">
                              {mention.name}
                            </span>
                            {mention.description ? (
                              <span className="text-muted-foreground text-xs truncate">
                                {mention.description}
                              </span>
                            ) : null}
                          </div>
                          <Button
                            variant={"ghost"}
                            size={"icon"}
                            disabled={!threadId}
                            className="rounded-full hover:bg-input! flex-shrink-0"
                            onClick={() => {
                              deleteMention(mention);
                            }}
                          >
                            <XIcon />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-col gap-3.5 px-5 pt-2 pb-4">
                  <div className="relative min-h-[2rem]">
                    <ChatMentionInput
                      input={input}
                      onChange={setInput}
                      onChangeMention={onChangeMention}
                      onEnter={submit}
                      placeholder={placeholder ?? t("placeholder")}
                      ref={editorRef}
                      disabledMention={disabledMention}
                      onFocus={onFocus}
                    />
                  </div>
                  <div className="flex w-full items-center z-30">
                    <Button
                      variant={"ghost"}
                      size={"sm"}
                      className="rounded-full hover:bg-input! p-2!"
                      onClick={notImplementedToast}
                    >
                      <PlusIcon />
                    </Button>
                    {onThinkingChange && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size={"sm"}
                            className={cn(
                              "rounded-full hover:bg-input! p-2!",
                              thinking && "bg-input!",
                            )}
                            onClick={() => {
                              onThinkingChange(!thinking);
                              editorRef.current?.commands.focus();
                            }}
                          >
                            <LightbulbIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          className="flex items-center gap-2"
                          side="top"
                        >
                          Sequential Thinking
                          <span className="text-muted-foreground ml-2">
                            {getShortcutKeyList(THINKING_SHORTCUT).join("")}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {!toolDisabled && (
                      <>
                        <ToolModeDropdown />
                        <ToolSelectDropdown
                          className="mx-1"
                          align="start"
                          side="top"
                          onSelectWorkflow={onSelectWorkflow}
                          onSelectAgent={onSelectAgent}
                          mentions={mentions}
                        />
                      </>
                    )}

                    <div className="flex-1" />

                    <SelectModel
                      onSelect={setChatModel}
                      defaultModel={chatModel}
                    >
                      <Button
                        variant={"ghost"}
                        size={"sm"}
                        className="rounded-full group data-[state=open]:bg-input! hover:bg-input! mr-1"
                      >
                        {chatModel?.model ? (
                          <>
                            {chatModel.provider === "openai" ? (
                              <OpenAIIcon className="size-3 opacity-0 group-data-[state=open]:opacity-100 group-hover:opacity-100" />
                            ) : chatModel.provider === "xai" ? (
                              <GrokIcon className="size-3 opacity-0 group-data-[state=open]:opacity-100 group-hover:opacity-100" />
                            ) : chatModel.provider === "anthropic" ? (
                              <ClaudeIcon className="size-3 opacity-0 group-data-[state=open]:opacity-100 group-hover:opacity-100" />
                            ) : chatModel.provider === "google" ? (
                              <GeminiIcon className="size-3 opacity-0 group-data-[state=open]:opacity-100 group-hover:opacity-100" />
                            ) : null}
                            <span className="text-foreground group-data-[state=open]:text-foreground  ">
                              {chatModel.model}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">model</span>
                        )}

                        <ChevronDown className="size-3" />
                      </Button>
                    </SelectModel>
                    {!isLoading && !input.length && !voiceDisabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size={"sm"}
                            onClick={() => {
                              appStoreMutate((state) => ({
                                voiceChat: {
                                  ...state.voiceChat,
                                  isOpen: true,
                                  agentId: undefined,
                                },
                              }));
                            }}
                            className="rounded-full p-2!"
                          >
                            <AudioWaveformIcon size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("VoiceChat.title")}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <div
                        onClick={() => {
                          if (isLoading) {
                            onStop();
                          } else {
                            submit();
                          }
                        }}
                        className="fade-in animate-in cursor-pointer text-muted-foreground rounded-full p-2 bg-secondary hover:bg-accent-foreground hover:text-accent transition-all duration-200"
                      >
                        {isLoading ? (
                          <Square
                            size={16}
                            className="fill-muted-foreground text-muted-foreground"
                          />
                        ) : (
                          <CornerRightUp size={16} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        </div>
      </div>
      </PromptContainer>
    </>
  );
}
