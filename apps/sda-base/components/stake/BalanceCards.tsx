import { useWalletManager } from '@noahsaso/cosmodal'
import { FunctionComponent } from 'react'
import { useTranslation } from 'react-i18next'

import { useGovernanceTokenInfo, useStakingInfo } from '@dao-dao/state'
import { Button, Trans } from '@dao-dao/ui'
import {
  convertMicroDenomToDenomWithDecimals,
  formatPercentOf100,
} from '@dao-dao/utils'

import { DAO_ADDRESS } from '@/util'

import { Loader } from '../Loader'
import { Logo } from '../Logo'

interface CardProps {
  setShowStakingMode: () => void
}

export const UnstakedBalanceCard: FunctionComponent<CardProps> = ({
  setShowStakingMode,
}) => {
  const { t } = useTranslation()
  const { connected } = useWalletManager()
  const { governanceTokenInfo, walletBalance: _unstakedBalance } =
    useGovernanceTokenInfo(DAO_ADDRESS, {
      fetchWalletBalance: true,
    })

  if (!governanceTokenInfo || (connected && _unstakedBalance === undefined)) {
    return <BalanceCardLoader />
  }

  const unstakedBalance = convertMicroDenomToDenomWithDecimals(
    _unstakedBalance ?? 0,
    governanceTokenInfo.decimals
  )

  return (
    <>
      <div className="flex flex-row gap-2 items-center mb-4">
        <Logo size={20} />
        <p className="text-base">
          {unstakedBalance.toLocaleString(undefined, {
            maximumFractionDigits: governanceTokenInfo.decimals,
          })}{' '}
          ${governanceTokenInfo.symbol}
        </p>
      </div>

      <div className="flex flex-row justify-end items-center">
        <Button
          className="text-base"
          disabled={!connected}
          onClick={setShowStakingMode}
          variant="secondary"
        >
          {t('button.manage')}
        </Button>
      </div>
    </>
  )
}

export const StakedBalanceCard: FunctionComponent<CardProps> = ({
  setShowStakingMode,
}) => {
  const { t } = useTranslation()
  const { connected } = useWalletManager()
  const { governanceTokenInfo } = useGovernanceTokenInfo(DAO_ADDRESS)
  const { totalStakedValue, walletStakedValue } = useStakingInfo(DAO_ADDRESS, {
    fetchTotalStakedValue: true,
    fetchWalletStakedValue: true,
  })

  if (
    !governanceTokenInfo ||
    totalStakedValue === undefined ||
    (connected && walletStakedValue === undefined)
  ) {
    return <BalanceCardLoader />
  }

  const stakedValue = convertMicroDenomToDenomWithDecimals(
    walletStakedValue ?? 0,
    governanceTokenInfo.decimals
  )

  return (
    <>
      <div className="flex flex-row justify-between items-center mb-4">
        <div className="flex flex-row gap-2 items-center">
          <Logo size={20} />
          <p className="text-base">
            {stakedValue.toLocaleString(undefined, {
              maximumFractionDigits: governanceTokenInfo.decimals,
            })}{' '}
            ${governanceTokenInfo.symbol}
          </p>
        </div>

        <p className="text-base text-secondary">
          <Trans i18nKey="info.percentOfAllVotingPower">
            {{
              percent: formatPercentOf100(
                totalStakedValue === 0
                  ? 0
                  : ((walletStakedValue ?? 0) / totalStakedValue) * 100
              ),
            }}{' '}
            <span className="text-xs text-tertiary">of all voting power</span>
          </Trans>
        </p>
      </div>

      <div className="flex flex-row justify-end items-center">
        <Button
          className="text-base"
          disabled={!connected}
          onClick={setShowStakingMode}
          variant="secondary"
        >
          {t('button.manage')}
        </Button>
      </div>
    </>
  )
}

export const BalanceCardLoader = () => (
  <div className="h-[5.25rem]">
    <Loader />
  </div>
)