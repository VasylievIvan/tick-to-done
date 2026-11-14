import { i18n } from './index.ts';

i18n.t('app.title');

// @ts-expect-error an unknown dictionary key must not compile
i18n.t('app.noSuchKey');
