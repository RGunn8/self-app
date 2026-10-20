import { router, useLocalSearchParams } from 'expo-router';
import { ChartLine, Pause, PencilLine, Play, RotateCcw, Undo2 } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { confirmRestart, resumeIdentity, undoRestart } from '@/features/identities/actions';
import { useIdentityView } from '@/features/identities/views';
import { ICON_STROKE, ListRow } from '@/shared/components/ui';
import { fmt } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

/** The identity's ••• menu: pause or resume, restart, edit, journey. */
export default function IdentityActionsSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const view = useIdentityView(id);
  if (!view) return null;
  const { identity, pause } = view;
  const icon = (I: typeof Pause) => <I size={20} color={p.text} strokeWidth={ICON_STROKE} />;
  const close = () => router.back();

  return (
    <ScrollView contentContainerClassName="p-gutter pt-6 gap-2">
      <Text className="font-heading text-display-sm text-ink pb-2">{identity.name}</Text>
      {pause ? (
        <ListRow
          left={icon(Play)}
          title="Resume"
          sub={pause.endDate ? `Paused until ${fmt.short(pause.endDate)}` : 'Paused until you resume'}
          onPress={() => {
            resumeIdentity(identity, pause);
            close();
          }}
        />
      ) : (
        <ListRow left={icon(Pause)} title="Pause" sub="Take a break. Not scored while paused." onPress={() => router.replace(`/identity/${identity.id}/pause`)} />
      )}
      {identity.restartedAt ? (
        <ListRow
          left={icon(Undo2)}
          title="Undo restart"
          sub={`Restarted ${fmt.short(identity.restartedAt)}. Count all history again.`}
          onPress={() => {
            undoRestart(identity);
            close();
          }}
        />
      ) : null}
      <ListRow left={icon(RotateCcw)} title="Restart" sub="A fresh start from today. History is kept." onPress={() => confirmRestart(identity, close)} />
      <View className="h-2" />
      <ListRow left={icon(ChartLine)} title="Journey" onPress={() => router.replace(`/identity/${identity.id}/journey`)} />
      <ListRow left={icon(PencilLine)} title="Edit" onPress={() => router.replace(`/identity/${identity.id}/edit`)} />
    </ScrollView>
  );
}
