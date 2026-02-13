import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type Point = { x: number; y: number };
type Trail = { id: number; x: number; y: number };
type BurstParticle = {
  id: number;
  dx: number;
  dy: number;
  delay: number;
  icon: string;
  color: string;
  size: number;
};
type FloatingHeart = {
  id: number;
  left: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
};

const QUESTIONS = [
  'Ты самая прекрасная девушка на планете?',
  'Ты умеешь делать мой день лучше одним сообщением?',
  'Согласна принять эту валентинку и моё сердце?',
];

const PLAYFUL_HINTS = ['ой!', 'не поймать 😅', 'я стесняюсь'];

const MILESTONE_HINTS: Record<number, string> = {
  10: 'ты очень настойчивая 😌',
  30: 'ещё чуть-чуть, но я смущаюсь',
  60: 'ты почти чемпион по ловле кнопок',
};

const NO_BUTTON_MIN_WIDTH = 136;
const NO_BUTTON_MIN_HEIGHT = 56;
const ESCAPE_COOLDOWN = 58;
const AREA_PADDING = 12;
const ESCAPE_JUMP_DESKTOP = 64;
const ESCAPE_JUMP_MOBILE = 58;
const ESCAPE_JITTER = 4;
const EDGE_BIAS_ZONE = 22;
const GIFT_FILE_NAME = 'Пирожочку.pdf';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number) =>
  min + Math.random() * Math.max(max - min, 1);

function App() {
  const [step, setStep] = useState<Step>(0);
  const [escapeCount, setEscapeCount] = useState(0);
  const [noPos, setNoPos] = useState<Point>({ x: 24, y: 24 });
  const [noLabel, setNoLabel] = useState('Нет');
  const [noPaused, setNoPaused] = useState(false);
  const [noHint, setNoHint] = useState('');
  const [noHintPos, setNoHintPos] = useState<Point>({ x: 32, y: 32 });
  const [isNoFloating, setIsNoFloating] = useState(false);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [bursts, setBursts] = useState<BurstParticle[]>([]);
  const [envelopeOpen, setEnvelopeOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isGiftAvailable, setIsGiftAvailable] = useState(true);

  const noButtonRef = useRef<HTMLButtonElement>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const noPosRef = useRef<Point>({ x: 24, y: 24 });
  const escapeCountRef = useRef(0);
  const lastEscapeAtRef = useRef(0);
  const pauseTimeoutRef = useRef<number>();
  const hintTimeoutRef = useRef<number>();

  const isQuestionStep = step >= 1 && step <= 3;
  const questionText = isQuestionStep ? QUESTIONS[step - 1] : '';
  const giftFileName = GIFT_FILE_NAME;
  const giftBaseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const giftFileUrl = `${giftBaseUrl}${encodeURIComponent(giftFileName)}`;

  const floatingHearts = useMemo<FloatingHeart[]>(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        duration: randomBetween(18, 34),
        delay: randomBetween(-22, -2),
        size: randomBetween(12, 22),
        opacity: randomBetween(0.16, 0.42),
      })),
    [],
  );

  const showHint = useCallback((text: string) => {
    setNoHint(text);
    window.clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = window.setTimeout(() => {
      setNoHint('');
    }, 1000);
  }, []);

  const spawnBurst = useCallback((count = 16) => {
    const particles: BurstParticle[] = Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count + randomBetween(-0.14, 0.14);
      const distance = randomBetween(72, 170);
      return {
        id: Date.now() + Math.random() + index,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        delay: randomBetween(0, 0.2),
        icon: Math.random() > 0.3 ? '❤' : '✦',
        color: Math.random() > 0.45 ? '#ff74d0' : '#95f6ff',
        size: randomBetween(12, 20),
      };
    });

    const ids = new Set(particles.map((particle) => particle.id));
    setBursts((prev) => [...prev, ...particles]);

    window.setTimeout(() => {
      setBursts((prev) => prev.filter((particle) => !ids.has(particle.id)));
    }, 1000);
  }, []);

  const getNoButtonSize = useCallback(() => {
    const button = noButtonRef.current;
    if (!button) {
      return { width: NO_BUTTON_MIN_WIDTH, height: NO_BUTTON_MIN_HEIGHT };
    }

    const rect = button.getBoundingClientRect();
    return {
      width: Math.max(rect.width, NO_BUTTON_MIN_WIDTH),
      height: Math.max(rect.height, NO_BUTTON_MIN_HEIGHT),
    };
  }, []);

  const getEscapeBounds = useCallback(() => {
    const { width: buttonWidth, height: buttonHeight } = getNoButtonSize();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const minX = AREA_PADDING;
    const maxX = Math.max(minX, viewportWidth - buttonWidth - AREA_PADDING);
    const minY = AREA_PADDING;
    const maxY = Math.max(minY, viewportHeight - buttonHeight - AREA_PADDING);

    return { minX, maxX, minY, maxY, buttonWidth, buttonHeight };
  }, [getNoButtonSize]);

  const clampToBounds = useCallback(
    (
      point: Point,
      bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
      },
    ) => ({
      x: clamp(point.x, bounds.minX, bounds.maxX),
      y: clamp(point.y, bounds.minY, bounds.maxY),
    }),
    [],
  );

  const constrainNoPosition = useCallback(() => {
    const bounds = getEscapeBounds();
    const nextPoint = clampToBounds(noPosRef.current, bounds);
    noPosRef.current = nextPoint;
    setNoPos(nextPoint);
  }, [clampToBounds, getEscapeBounds]);

  const ensureNoFloating = useCallback(() => {
    if (isNoFloating) return;

    const bounds = getEscapeBounds();
    const yesRect = yesButtonRef.current?.getBoundingClientRect();
    if (yesRect) {
      const gap = 14;
      const rightX = yesRect.right + gap;
      const nextPoint = clampToBounds(
        {
          x: rightX,
          y: yesRect.top + (yesRect.height - bounds.buttonHeight) / 2,
        },
        bounds,
      );
      noPosRef.current = nextPoint;
      setNoPos(nextPoint);
    } else {
      const staticRect = noButtonRef.current?.getBoundingClientRect();
      if (staticRect) {
        const fromStatic = clampToBounds(
          {
            x: staticRect.left,
            y: staticRect.top,
          },
          bounds,
        );
        noPosRef.current = fromStatic;
        setNoPos(fromStatic);
      } else {
        const randomPoint = {
          x: randomBetween(bounds.minX, bounds.maxX),
          y: randomBetween(bounds.minY, bounds.maxY),
        };
        noPosRef.current = randomPoint;
        setNoPos(randomPoint);
      }
    }

    setIsNoFloating(true);
  }, [clampToBounds, getEscapeBounds, isNoFloating]);

  const moveNoButton = useCallback((pointer?: Point) => {
    const bounds = getEscapeBounds();

    const current = noPosRef.current;
    const jump = isTouch ? ESCAPE_JUMP_MOBILE : ESCAPE_JUMP_DESKTOP;
    const nearLeft = current.x <= bounds.minX + EDGE_BIAS_ZONE;
    const nearRight = current.x >= bounds.maxX - EDGE_BIAS_ZONE;
    const nearTop = current.y <= bounds.minY + EDGE_BIAS_ZONE;
    const nearBottom = current.y >= bounds.maxY - EDGE_BIAS_ZONE;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      let nextX = current.x;
      let nextY = current.y;

      if (nearLeft || nearRight) {
        const awayX = nearLeft ? 1 : -1;
        const verticalDir = Math.random() < 0.5 ? -1 : 1;
        nextX += awayX * jump * 0.34 + randomBetween(-ESCAPE_JITTER, ESCAPE_JITTER);
        nextY += verticalDir * jump * 1.06 + randomBetween(-ESCAPE_JITTER, ESCAPE_JITTER);
      }

      if (nearTop || nearBottom) {
        const awayY = nearTop ? 1 : -1;
        const horizontalDir = Math.random() < 0.5 ? -1 : 1;
        nextY += awayY * jump * 0.34 + randomBetween(-ESCAPE_JITTER, ESCAPE_JITTER);
        nextX += horizontalDir * jump * 1.06 + randomBetween(-ESCAPE_JITTER, ESCAPE_JITTER);
      }

      const edgePoint = clampToBounds({ x: nextX, y: nextY }, bounds);
      noPosRef.current = edgePoint;
      setNoPos(edgePoint);
      return;
    }

    const centerX = current.x + bounds.buttonWidth / 2;
    const centerY = current.y + bounds.buttonHeight / 2;
    let baseAngle = Math.random() * Math.PI * 2;

    if (pointer) {
      baseAngle = Math.atan2(centerY - pointer.y, centerX - pointer.x);
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const spin =
        attempt === 0
          ? 0
          : (attempt % 2 === 0 ? 1 : -1) * (Math.PI / 6 + Math.random() * (Math.PI / 8));
      const angle = baseAngle + spin;
      const candidate = {
        x: current.x + Math.cos(angle) * jump + randomBetween(-ESCAPE_JITTER, ESCAPE_JITTER),
        y:
          current.y +
          Math.sin(angle) * jump * 0.82 +
          randomBetween(-ESCAPE_JITTER, ESCAPE_JITTER),
      };
      const clampedCandidate = clampToBounds(candidate, bounds);
      const deltaX = clampedCandidate.x - current.x;
      const deltaY = clampedCandidate.y - current.y;
      const movedDistance = Math.hypot(deltaX, deltaY);
      const pinnedX =
        clampedCandidate.x === bounds.minX || clampedCandidate.x === bounds.maxX;
      const pinnedY =
        clampedCandidate.y === bounds.minY || clampedCandidate.y === bounds.maxY;
      const hasVerticalMotion = Math.abs(deltaY) >= 8;
      const hasHorizontalMotion = Math.abs(deltaX) >= 8;

      if (
        movedDistance >= 22 &&
        (!pinnedX || hasVerticalMotion) &&
        (!pinnedY || hasHorizontalMotion)
      ) {
        noPosRef.current = clampedCandidate;
        setNoPos(clampedCandidate);
        return;
      }
    }

    const fallback = clampToBounds(
      {
        x: randomBetween(bounds.minX, bounds.maxX),
        y: randomBetween(bounds.minY, bounds.maxY),
      },
      bounds,
    );
    noPosRef.current = fallback;
    setNoPos(fallback);
  }, [clampToBounds, getEscapeBounds, isTouch]);

  const addTrail = useCallback(() => {
    const id = Date.now() + Math.random();
    const buttonRect = noButtonRef.current?.getBoundingClientRect();
    const { width: buttonWidth, height: buttonHeight } = getNoButtonSize();
    const trail = {
      id,
      x: buttonRect ? buttonRect.left + buttonRect.width / 2 : noPosRef.current.x + buttonWidth / 2,
      y: buttonRect ? buttonRect.top + buttonRect.height / 2 : noPosRef.current.y + buttonHeight / 2,
    };

    setTrails((prev) => [...prev.slice(-6), trail]);

    window.setTimeout(() => {
      setTrails((prev) => prev.filter((item) => item.id !== id));
    }, 550);
  }, [getNoButtonSize]);

  const pauseNoForASecond = useCallback(() => {
    setNoPaused(true);
    setNoLabel('ну лааадно 😳');
    window.clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = window.setTimeout(() => {
      setNoPaused(false);
      setNoLabel('Нет');
    }, 1000);
  }, []);

  const registerNoEscape = useCallback(
    (pointer?: Point) => {
      if (!isQuestionStep || noPaused) return;

      ensureNoFloating();

      const now = Date.now();
      if (now - lastEscapeAtRef.current < ESCAPE_COOLDOWN) return;
      lastEscapeAtRef.current = now;

      const nextEscapeCount = escapeCountRef.current + 1;
      escapeCountRef.current = nextEscapeCount;
      setEscapeCount(nextEscapeCount);

      if (nextEscapeCount % 99 === 0) {
        showHint('ну лааадно 😳');
        pauseNoForASecond();
        return;
      }

      const milestoneHint = MILESTONE_HINTS[nextEscapeCount];
      if (milestoneHint) {
        showHint(milestoneHint);
      } else if (Math.random() < 0.24) {
        showHint(PLAYFUL_HINTS[Math.floor(Math.random() * PLAYFUL_HINTS.length)]);
      }

      if (Math.random() < 0.38) {
        addTrail();
      }

      moveNoButton(pointer);
    },
    [
      addTrail,
      ensureNoFloating,
      isQuestionStep,
      moveNoButton,
      noPaused,
      pauseNoForASecond,
      showHint,
    ],
  );

  const handleYes = useCallback(() => {
    spawnBurst(17);
    window.navigator.vibrate?.(22);

    if (step >= 1 && step < 3) {
      setStep((prev) => (prev + 1) as Step);
      return;
    }

    if (step === 3) {
      setStep(4);
    }
  }, [spawnBurst, step]);

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    setIsTouch(coarsePointer || 'ontouchstart' in window);
  }, []);

  useEffect(() => {
    escapeCountRef.current = escapeCount;
  }, [escapeCount]);

  useEffect(
    () => () => {
      window.clearTimeout(pauseTimeoutRef.current);
      window.clearTimeout(hintTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isQuestionStep) {
      setTrails([]);
      setNoHint('');
      setIsNoFloating(false);
      setNoPaused(false);
      setNoLabel('Нет');
      return;
    }

    setTrails([]);
    setNoHint('');
    setIsNoFloating(false);
  }, [isQuestionStep, step]);

  useEffect(() => {
    if (!isQuestionStep || !isNoFloating) return;
    constrainNoPosition();
  }, [constrainNoPosition, isNoFloating, isQuestionStep, noLabel, noPaused]);

  useEffect(() => {
    if (!isQuestionStep || !isNoFloating) return;

    const frameId = window.requestAnimationFrame(() => {
      const rect = noButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setNoHintPos({
        x: rect.left + 8,
        y: rect.top - 34,
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isQuestionStep, isNoFloating, noLabel, noPos]);

  useEffect(() => {
    if (!isQuestionStep || !isNoFloating) return;

    const handleViewportChange = () => {
      window.requestAnimationFrame(() => {
        constrainNoPosition();
      });
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [constrainNoPosition, isNoFloating, isQuestionStep]);

  useEffect(() => {
    if (!isQuestionStep || !isNoFloating) return;

    const button = noButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const outOfView =
      rect.right < 0 ||
      rect.left > window.innerWidth ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight;

    if (outOfView) {
      const bounds = getEscapeBounds();
      const yesRect = yesButtonRef.current?.getBoundingClientRect();
      const fallbackPoint = yesRect
        ? clampToBounds(
            {
              x: yesRect.right + 14,
              y: yesRect.top + (yesRect.height - bounds.buttonHeight) / 2,
            },
            bounds,
          )
        : clampToBounds(
            {
              x: window.innerWidth * 0.55,
              y: window.innerHeight * 0.55,
            },
            bounds,
          );

      noPosRef.current = fallbackPoint;
      setNoPos(fallbackPoint);
    }
  }, [clampToBounds, getEscapeBounds, isNoFloating, isQuestionStep, noPos]);

  useEffect(() => {
    if (step === 4) {
      spawnBurst(20);
    }
  }, [spawnBurst, step]);

  useEffect(() => {
    if (step !== 5) return;

    setEnvelopeOpen(false);
    const timeout = window.setTimeout(() => {
      setEnvelopeOpen(true);
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [step]);

  useEffect(() => {
    if (step !== 5) return;

    const controller = new AbortController();
    let isActive = true;

    const checkGiftFile = async () => {
      try {
        const headResponse = await fetch(giftFileUrl, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!isActive) return;

        if (headResponse.ok) {
          setIsGiftAvailable(true);
          return;
        }

        if (headResponse.status !== 405 && headResponse.status !== 501) {
          setIsGiftAvailable(false);
          return;
        }
      } catch {
        if (controller.signal.aborted || !isActive) return;
      }

      try {
        const getResponse = await fetch(giftFileUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!isActive) return;
        setIsGiftAvailable(getResponse.ok);
      } catch {
        if (!controller.signal.aborted && isActive) {
          setIsGiftAvailable(false);
        }
      }
    };

    void checkGiftFile();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [giftFileUrl, step]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floatingHearts.map((heart) => (
          <span
            key={heart.id}
            className="heart-float"
            style={{
              left: `${heart.left}%`,
              fontSize: `${heart.size}px`,
              opacity: heart.opacity,
              animationDuration: `${heart.duration}s`,
              animationDelay: `${heart.delay}s`,
            }}
          >
            ❤
          </span>
        ))}
      </div>

      <section className="neon-card relative z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-[32px] p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {bursts.map((particle) => (
            <span
              key={particle.id}
              className="burst-item"
              style={{
                '--dx': `${particle.dx}px`,
                '--dy': `${particle.dy}px`,
                '--delay': `${particle.delay}s`,
                '--color': particle.color,
                '--size': `${particle.size}px`,
              } as CSSProperties}
            >
              {particle.icon}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="animate-fade-slow text-center">
            <h1 className="card-title mb-4 text-5xl text-pink-200 sm:text-6xl">
              У меня к тебе 3 вопроса 💜
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-sm text-slate-200/90 sm:text-base">
              Всего несколько секунд на каждый, а настроение пусть останется тёплым на весь вечер.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="neon-button neon-button-yes mx-auto"
            >
              Начать
            </button>
          </div>
        )}

        {isQuestionStep && (
          <div className="animate-fade-slow relative">
            <p className="mb-4 text-xs uppercase tracking-[0.28em] text-violet-200/80">
              вопрос {step} из 3
            </p>
            <h2 className="mb-2 text-2xl font-extrabold leading-tight text-slate-100 sm:text-3xl">
              {questionText}
            </h2>

            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                ref={yesButtonRef}
                type="button"
                onClick={handleYes}
                className="neon-button neon-button-yes"
              >
                Да
              </button>

              {!isNoFloating ? (
                <button
                  ref={noButtonRef}
                  type="button"
                  aria-label="Кнопка Нет"
                  onMouseEnter={(event) => {
                    if (!isTouch && !noPaused) {
                      registerNoEscape({ x: event.clientX, y: event.clientY });
                    }
                  }}
                  onMouseMove={(event) => {
                    if (!isTouch && !noPaused) {
                      registerNoEscape({ x: event.clientX, y: event.clientY });
                    }
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                  onPointerDown={(event) => {
                    if (noPaused) return;

                    if (event.pointerType === 'touch' || isTouch) {
                      event.preventDefault();
                      registerNoEscape({ x: event.clientX, y: event.clientY });
                    }
                  }}
                  className="neon-button neon-button-no"
                >
                  {noLabel}
                </button>
              ) : (
                <span aria-hidden="true" className="neon-button neon-button-no pointer-events-none opacity-0">
                  Нет
                </span>
              )}
            </div>

            <span className="sr-only">Счётчик побегов кнопки: {escapeCount}</span>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-slow text-center">
            <h2 className="card-title mb-3 text-6xl text-cyan-100 sm:text-7xl">Я знал 😌</h2>
            <p className="mx-auto mb-7 max-w-xl text-sm text-slate-200/90 sm:text-base">
              Небольшой сюрприз уже готов.
            </p>
            <button
              type="button"
              onClick={() => {
                spawnBurst(24);
                setStep(5);
              }}
              className="neon-button neon-button-yes mx-auto"
            >
              Открыть валентинку
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="animate-fade-slow text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.28em] text-violet-200/80">письмо для тебя</p>
            <h2 className="card-title relative z-20 mb-6 text-5xl text-pink-200 sm:text-6xl">
              Моя валентинка
            </h2>

            <div
              className={`envelope-shell mx-auto w-full max-w-xl ${envelopeOpen ? 'envelope-open' : ''}`}
              onClick={() => setEnvelopeOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setEnvelopeOpen(true);
                }
              }}
            >
              <div className="envelope-back" />
              <div className="envelope-letter">
                <p>Мой Пирожочек,</p>
                <p>Ты красотка, бубочка, лапуля, радость и принцесса (когда не чихаешь)</p>
                <p>С тобой даже обычный вечер превращается в маленький праздник.</p>
                <p>Мне нравится, как мы смеёмся над своими мелочами и понимаем друг друга с полуслова (иногда даже без).</p>
                <p>Спасибо тебе за нежность, терпение и твоё живое, настоящее сердце.</p>
                <p>Я рядом, и хочу беречь это «мы» каждый день.</p>
                <p className="mt-4 text-right">С любовью, Котик ❤</p>
              </div>
              <div className="envelope-flap" />
              <div className="envelope-front" />
            </div>

            <div className="gift-panel mx-auto mt-6 w-fit text-center">
              <p className="gift-title">Твой Подарок</p>
              <div className="gift-actions mt-3 justify-center">
                {isGiftAvailable ? (
                  <a
                    href={giftFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="neon-button neon-button-yes"
                  >
                    Открыть подарок
                  </a>
                ) : (
                  <p className="gift-note">Подарок не найден в папке gift-files.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {isQuestionStep && isNoFloating && (
        <>
          <div className="pointer-events-none fixed inset-0 z-40">
            {trails.map((trail) => (
              <span
                key={trail.id}
                className="no-trail"
                style={{ left: trail.x, top: trail.y }}
              />
            ))}

            <p
              className={`absolute rounded-full border border-pink-300/40 bg-slate-950/45 px-3 py-1 text-xs text-pink-100 transition-opacity duration-300 ${
                noHint ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ left: noHintPos.x, top: noHintPos.y }}
            >
              {noHint || '...'}
            </p>
          </div>

          <button
            ref={noButtonRef}
            type="button"
            aria-label="Кнопка Нет"
            onMouseEnter={(event) => {
              if (!isTouch && !noPaused) {
                registerNoEscape({ x: event.clientX, y: event.clientY });
              }
            }}
            onMouseMove={(event) => {
              if (!isTouch && !noPaused) {
                registerNoEscape({ x: event.clientX, y: event.clientY });
              }
            }}
            onClick={(event) => {
              event.preventDefault();
            }}
            onPointerDown={(event) => {
              if (noPaused) return;

              if (event.pointerType === 'touch' || isTouch) {
                event.preventDefault();
                registerNoEscape({ x: event.clientX, y: event.clientY });
              }
            }}
            className="neon-button neon-button-no fixed left-0 top-0 z-50"
            style={{ transform: `translate3d(${noPos.x}px, ${noPos.y}px, 0)` }}
          >
            {noLabel}
          </button>
        </>
      )}
    </main>
  );
}

export default App;
