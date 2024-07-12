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

const getFullXPath = (element: Element) => {
  if (!(element instanceof Element)) return;

  const getElementIndex = (node: Node) => {
    let index = 1;
    let sibling = node.previousSibling;
    while (sibling) {
      if (
        sibling.nodeType === Node.ELEMENT_NODE &&
        sibling.nodeName === node.nodeName
      ) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    return index;
  };

  const getPathSegment = (node: Node) => {
    const tagName = node.nodeName.toLowerCase();
    const index = getElementIndex(node);
    return `${tagName}[${index}]`;
  };

  const segments = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    segments.unshift(getPathSegment(element));
    element = element.parentNode;
  }

  // 使用 '.' 作为分隔符，并移除第一个元素前面的分隔符
  return segments.length ? `${segments.join('.')}` : null;
};

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
    element: getFullXPath(el),
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
    element: getFullXPath(el),
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
    element: getFullXPath(el),
    text: el.value || '',
    elementPosition: { x: absoluteLeft, y: absoluteTop, width, height },
  };

  console.log('🚀 ~ inputEventListener ~ eventData:', eventData);

  record.addCustomEvent('text-input', eventData);
};

const getDirection = (
  prev: number,
  current: number,
  dir: 'vertical' | 'horizontal',
) => {
  if (prev === current) return 'normal';

  if (dir === 'vertical') {
    return current > prev ? 'down' : 'up';
  } else if (dir === 'horizontal') {
    return current > prev ? 'right' : 'left';
  }
};

const isDocumentElement = (element: any) => {
  return element === document || element === document.documentElement;
};

const scrollEventListener = (e: Event) => {
  const el = (
    isDocumentElement(e.target) ? document.scrollingElement : e.target
  ) as HTMLElement;

  const previousScrollTop = el?.getAttribute('data-prev-scrollTop') || '0';
  const previousScrollLeft = el?.getAttribute('data-prev-scrollLeft') || '0';

  // 初始化之前的滚动位置
  el?.setAttribute('data-prev-scrollTop', previousScrollTop);
  el?.setAttribute('data-prev-scrollLeft', previousScrollLeft);

  const direction = {
    vertical: getDirection(~~previousScrollTop, el.scrollTop, 'vertical'),
    horizontal: getDirection(~~previousScrollLeft, el.scrollLeft, 'horizontal'),
  };

  const offset = {
    vertical: Math.abs(el.scrollTop - Number(previousScrollTop)),
    horizontal: Math.abs(el.scrollLeft - Number(previousScrollLeft)),
  };

  // 更新之前的滚动位置
  el?.setAttribute('data-prev-scrollTop', String(el.scrollTop || 0));
  el?.setAttribute('data-prev-scrollLeft', String(el.scrollLeft || 0));

  const eventData = {
    // element: el?.outerHTML,
    direction,
    offset,
  };

  console.log('🚀 ~ scrollEventListener ~ eventData:', eventData);

  record.addCustomEvent('scroll', eventData);
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
      window.addEventListener('scrollend', scrollEventListener, true);
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
      window.removeEventListener('scrollend', scrollEventListener, true);
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
