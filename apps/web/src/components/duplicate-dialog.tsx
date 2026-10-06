import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface DuplicateTarget {
  path: string;
  fileName: string;
  matchId: string;
}

export function DuplicateDialog({
  target,
  onOpenExisting,
  onReprocess,
  onCancel,
}: {
  target: DuplicateTarget | null;
  onOpenExisting: (matchId: string) => void;
  onReprocess: (path: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('misc2.duplicate')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono text-xs">{target?.fileName}</span>
            <br />
            <br />
            {t('ui2.duplicateHint')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => target && onReprocess(target.path)}
          >
            {t('reprocess.button')}
          </Button>
          <AlertDialogAction onClick={() => target && onOpenExisting(target.matchId)}>
            {t('ui.openExisting')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
