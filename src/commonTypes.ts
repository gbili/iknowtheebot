import { MessageEntity } from "typegram";


// When user has a @username
export function isMention(e: MessageEntity.AbstractMessageEntity): e is MessageEntity.CommonMessageEntity {
  return e.type === 'mention';
}

// When user has no @username, people can still use their name if they are in their contacts
export function isTextMention(e: MessageEntity.AbstractMessageEntity): e is MessageEntity.TextMentionMessageEntity {
  return e.type === 'text_mention';
}