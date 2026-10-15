import { Link } from './Link.tsx';

export function Loading({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="plate h-24 animate-pulse opacity-70" />
      ))}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="plate-white border-primary p-4 text-sm">
      <p className="font-bold text-primary">불러오지 못했어요</p>
      <p className="mt-1">{error instanceof Error ? error.message : '잠시 후 다시 시도하세요.'}</p>
      {retry && (
        <button onClick={retry} className="btn-signal mt-3 min-h-11 px-4">
          다시 시도
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="plate bg-sky p-6 text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mt-2 text-sm text-chrome">{children}</div>}
    </div>
  );
}

export function NotFound() {
  return (
    <Empty title="페이지를 찾을 수 없어요">
      <Link href="/" className="font-bold underline">
        과일 시세로 가기
      </Link>
    </Empty>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="label-bar">
      {children}
    </h2>
  );
}
