import { useTranslation } from 'react-i18next';
import {
  canBuyUpgrade,
  complexityRangeAt,
  currentUpgradeCost,
  isRepeatableUpgrade,
  isUpgradeExhausted,
  upgradeEffectAt,
  upgradeLevel,
  visibleUpgrades,
} from '../../core/selectors.ts';
import { MICROSECONDS_PER_SECOND, type UpgradeId } from '../../core/rules.ts';
import { useDispatch, useGame, useGameList, useRules } from '../GameContext.tsx';
import panel from '../Panel.module.css';
import styles from './Shop.module.css';

function useEffectText(id: UpgradeId, level: number, exhausted: boolean): string {
  const { t } = useTranslation();
  const rules = useRules();
  if (!isRepeatableUpgrade(id)) return t(`shop.upgrade.${id}.effect`);
  if (id === 'biggerTasks') {
    const current = complexityRangeAt(rules, level);
    const next = complexityRangeAt(rules, level + 1);
    return t('shop.upgrade.biggerTasks.effect', {
      currentMin: current.min,
      currentMax: current.max,
      nextMin: next.min,
      nextMax: next.max,
    });
  }
  const current = upgradeEffectAt(rules, id, level);
  const next = upgradeEffectAt(rules, id, level + 1);
  if (id === 'aiTickSpeed' || id === 'fasterBacklog') {
    const seconds = { current: current / MICROSECONDS_PER_SECOND, next: next / MICROSECONDS_PER_SECOND };
    return exhausted ? t(`shop.upgrade.${id}.effectMaxed`, seconds) : t(`shop.upgrade.${id}.effect`, seconds);
  }
  return t(`shop.upgrade.${id}.effect`, { current, next });
}

function ShopItem({ id }: { id: UpgradeId }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const level = useGame((game) => upgradeLevel(game, id));
  const cost = useGame((game, rules) => currentUpgradeCost(game, rules, id));
  const exhausted = useGame((game, rules) => isUpgradeExhausted(game, rules, id));
  const affordable = useGame((game, rules) => canBuyUpgrade(game, rules, id));
  const repeatable = isRepeatableUpgrade(id);
  const effect = useEffectText(id, level, exhausted);

  return (
    <li className={styles.item} data-upgrade={id}>
      <div className={styles.name}>
        {t(`shop.upgrade.${id}.name`)}
        {repeatable && level > 0 && <span className={styles.level}>{t('shop.level', { value: level })}</span>}
      </div>
      <div className={styles.action}>
        {exhausted ? (
          <span className={styles.lozenge}>{repeatable ? t('shop.maxed') : t('shop.purchased')}</span>
        ) : (
          <>
            <span className={styles.price}>{t('shop.price', { value: cost })}</span>
            <button
              type="button"
              className={styles.buy}
              disabled={!affordable}
              onClick={() => dispatch({ type: 'buyUpgrade', upgrade: id })}
            >
              {t('shop.buy')}
            </button>
          </>
        )}
      </div>
      <div className={styles.effect}>{effect}</div>
    </li>
  );
}

export function Shop() {
  const { t } = useTranslation();
  const ids = useGameList(visibleUpgrades);
  return (
    <section className={panel.panel} aria-label={t('shop.title')}>
      <h2 className={panel.title}>{t('shop.title')}</h2>
      <ul className={panel.list}>
        {ids.map((id) => (
          <ShopItem key={id} id={id} />
        ))}
      </ul>
    </section>
  );
}
