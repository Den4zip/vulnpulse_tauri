import { useEffect, useState } from 'react';
import { commandErrorMessage } from './lib/api/errors';

type Result<T> = { data: T; error?: never } | { data?: never; error: string };

export function useCatalogRequest<Q, T>(
  load: (request: Q) => Promise<T>,
  request: Q,
  revision: number,
  delay: number,
) {
  const [state, setState] = useState<{ request: Q; revision: number; result: Result<T> }>();

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void load(request).then(
        (data) => { if (active) setState({ request, revision, result: { data } }); },
        (error: unknown) => {
          if (active) setState({ request, revision, result: { error: commandErrorMessage(error) } });
        },
      );
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load, request, revision, delay]);

  return {
    current: state?.request === request && state.revision === revision ? state.result : undefined,
    previous: state?.result.data,
    previousRequest: state?.request,
  };
}
