import { record } from 'rrweb';
import type { recordOptions } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';
import { MessageName, type RecordStartedMessage } from '~/types';
import { isInCrossOriginIFrame } from '~/utils';

/**
 * This script is injected into both main page and cross-origin IFrames through <script> tags.
 */

const events: eventWithTime[] = [];
let stopFn: (() => void) | null = null;

const clickEventListener = (e: MouseEvent) => {
  const el = e.target as HTMLElement;

  // 获取元素的边界矩形
  const rect = el.getBoundingClientRect();

  // 获取宽度和高度
  const width = rect.width;
  const height = rect.height;

  // 获取绝对位置
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const absoluteTop = rect.top + scrollTop;
  const absoluteLeft = rect.left + scrollLeft;

  const eventData = {
    element: el.outerHTML,
    text: el.innerText || '',
    position: { x: e.clientX, y: e.clientY },
    elementPosition: { x: absoluteLeft, y: absoluteTop, width, height },
    alt: el.getAttribute('alt') || '',
  };

  console.log('🚀 ~ clickEventListener ~ eventData:', eventData);

  record.addCustomEvent('mouse-click', eventData);
};

const focusEventListener = (e: FocusEvent) => {
  const el = e.target as HTMLElement;

  // 获取元素的边界矩形
  const rect = el.getBoundingClientRect();

  // 获取宽度和高度
  const width = rect.width;
  const height = rect.height;

  // 获取绝对位置
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const absoluteTop = rect.top + scrollTop;
  const absoluteLeft = rect.left + scrollLeft;

  const eventData = {
    element: el.outerHTML,
    text: el.innerText || '',
    elementPosition: { x: absoluteLeft, y: absoluteTop, width, height },
    alt: el.getAttribute('alt') || '',
  };

  console.log('🚀 ~ focusEventListener ~ eventData:', eventData);

  record.addCustomEvent('focus-event', eventData);
};

const inputEventListener = (e: Event) => {
  const el = e.target as HTMLInputElement;

  // 获取元素的边界矩形
  const rect = el.getBoundingClientRect();

  // 获取宽度和高度
  const width = rect.width;
  const height = rect.height;

  // 获取绝对位置
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const absoluteTop = rect.top + scrollTop;
  const absoluteLeft = rect.left + scrollLeft;

  const eventData = {
    element: el.outerHTML,
    text: el.value || '',
    elementPosition: { x: absoluteLeft, y: absoluteTop, width, height },
  };

  console.log('🚀 ~ inputEventListener ~ eventData:', eventData);

  record.addCustomEvent('text-input', eventData);
};

function startRecord(config: recordOptions<eventWithTime>) {
  events.length = 0;
  stopFn =
    record({
      emit: (event) => {
        events.push(event);
        postMessage({
          message: MessageName.EmitEvent,
          event,
        });
      },
      ...config,
    }) || null;
  postMessage({
    message: MessageName.RecordStarted,
    startTimestamp: Date.now(),
  } as RecordStartedMessage);
}

const messageHandler = (
  event: MessageEvent<{
    message: MessageName;
    config?: recordOptions<eventWithTime>;
  }>,
) => {
  if (event.source !== window) return;
  const data = event.data;
  const eventHandler = {
    [MessageName.StartRecord]: () => {
      startRecord(data.config || {});
      window.addEventListener('click', clickEventListener);
      window.addEventListener('focusin', focusEventListener);
      window.addEventListener('input', inputEventListener);
    },
    [MessageName.StopRecord]: () => {
      if (stopFn) {
        try {
          stopFn();
        } catch (e) {
          //
        }
      }
      postMessage({
        message: MessageName.RecordStopped,
        events,
        endTimestamp: Date.now(),
      });
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('click', clickEventListener);
      window.removeEventListener('focus', focusEventListener);
      window.removeEventListener('input', inputEventListener);
    },
  } as Record<MessageName, () => void>;
  if (eventHandler[data.message]) eventHandler[data.message]();
};

/**
 * Only post message in the main page.
 */
function postMessage(message: unknown) {
  if (!isInCrossOriginIFrame()) window.postMessage(message, location.origin);
}

window.addEventListener('message', messageHandler);

window.postMessage(
  {
    message: MessageName.RecordScriptReady,
  },
  location.origin,
);
