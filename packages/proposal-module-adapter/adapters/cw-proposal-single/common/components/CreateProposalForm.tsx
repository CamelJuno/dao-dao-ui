import { findAttribute } from '@cosmjs/stargate/build/logs'
import { EyeIcon, EyeOffIcon } from '@heroicons/react/outline'
import { useRouter } from 'next/router'
import { ComponentType, useCallback, useEffect, useMemo, useState } from 'react'
import {
  FormProvider,
  SubmitErrorHandler,
  SubmitHandler,
  useFieldArray,
  useForm,
} from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { constSelector, useRecoilValue, useSetRecoilState } from 'recoil'

import { useActions } from '@dao-dao/actions'
import { SuspenseLoader, useDaoInfoContext } from '@dao-dao/common'
import { Airplane, Open } from '@dao-dao/icons'
import {
  Cw20BaseHooks,
  Cw20BaseSelectors,
  CwCoreV0_1_0Selectors,
  CwProposalSingleHooks,
  CwProposalSingleSelectors,
  blockHeightSelector,
  cosmWasmClientSelector,
  refreshWalletBalancesIdAtom,
  useVotingModule,
} from '@dao-dao/state'
import {
  Action,
  ActionKey,
  ProposalModule,
  UseDefaults,
  UseTransformToCosmos,
} from '@dao-dao/tstypes'
import { CosmosMsgFor_Empty } from '@dao-dao/types/contracts/cw3-dao'
import {
  ActionCardLoader,
  ActionSelector,
  Button,
  CosmosMessageDisplay,
  InputErrorMessage,
  InputLabel,
  LoaderProps,
  LogoProps,
  MarkdownPreview,
  TextAreaInput,
  TextInput,
  Tooltip,
} from '@dao-dao/ui'
import {
  convertExpirationToDate,
  dateToWdhms,
  decodedMessagesString,
  expirationExpired,
  processError,
  usePlatform,
  validateRequired,
} from '@dao-dao/utils'
import { useVotingModuleAdapter } from '@dao-dao/voting-module-adapter'

import { BaseNewProposalProps } from '../../../../types'
import { makeGetProposalInfo } from '../../functions'
import { NewProposalData, NewProposalForm } from '../../types'
import { makeUseActions as makeUseProposalModuleActions } from '../hooks'

enum ProposeSubmitValue {
  Preview = 'Preview',
  Submit = 'Submit',
}

interface CreateProposalFormProps extends BaseNewProposalProps {
  coreAddress: string
  proposalModule: ProposalModule
  Loader: ComponentType<LoaderProps>
  Logo: ComponentType<LogoProps>
  connected: boolean
  walletAddress: string
  ConnectWalletButton: ComponentType
}

export const CreateProposalForm = ({
  coreAddress,
  proposalModule,
  Loader,
  Logo,
  connected,
  walletAddress,
  onCreateSuccess,
  ConnectWalletButton,
}: CreateProposalFormProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { coreVersion } = useDaoInfoContext()

  const {
    hooks: { useActions: useVotingModuleActions },
  } = useVotingModuleAdapter()
  const { isMember } = useVotingModule(coreAddress, { fetchMembership: true })
  const { address: proposalModuleAddress, prefix: proposalModulePrefix } =
    proposalModule

  const config = useRecoilValue(
    CwProposalSingleSelectors.configSelector({
      contractAddress: proposalModuleAddress,
    })
  )

  const blockHeight = useRecoilValue(blockHeightSelector)

  const requiredProposalDeposit = Number(config.deposit_info?.deposit ?? '0')

  const allowanceResponse = useRecoilValue(
    config.deposit_info && requiredProposalDeposit && walletAddress
      ? Cw20BaseSelectors.allowanceSelector({
          contractAddress: config.deposit_info.token,
          params: [{ owner: walletAddress, spender: proposalModuleAddress }],
        })
      : constSelector(undefined)
  )

  const increaseAllowance = Cw20BaseHooks.useIncreaseAllowance({
    contractAddress: config.deposit_info?.token ?? '',
    sender: walletAddress ?? '',
  })
  const createProposal = CwProposalSingleHooks.usePropose({
    contractAddress: proposalModuleAddress,
    sender: walletAddress ?? '',
  })

  // Info about if deposit can be paid.
  const depositTokenBalance = useRecoilValue(
    config.deposit_info?.deposit &&
      config.deposit_info?.deposit !== '0' &&
      walletAddress
      ? Cw20BaseSelectors.balanceSelector({
          contractAddress: config.deposit_info.token,
          params: [{ address: walletAddress }],
        })
      : constSelector(undefined)
  )

  const canPayDeposit =
    !config.deposit_info?.deposit ||
    config.deposit_info?.deposit === '0' ||
    Number(depositTokenBalance?.balance) >= Number(config.deposit_info?.deposit)

  // Info about if the DAO is paused.
  const pauseInfo = useRecoilValue(
    CwCoreV0_1_0Selectors.pauseInfoSelector({ contractAddress: coreAddress })
  )
  const isPaused = 'Paused' in pauseInfo

  const formMethods = useForm<NewProposalForm>({
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      actionData: [],
    },
  })

  // Unpack here because we use these at the top level as well as
  // inside of nested components.
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = formMethods

  // Prefill form with data from parameter once ready.
  useEffect(() => {
    const potentialDefaultValue = router.query.prefill
    if (!router.isReady || typeof potentialDefaultValue !== 'string') {
      return
    }

    try {
      const data = JSON.parse(potentialDefaultValue)
      if (data.constructor.name === 'Object') {
        reset(data)
      }
      // If failed to parse, do nothing.
    } catch {}
  }, [router.query.prefill, router.isReady, reset])

  const [showPreview, setShowPreview] = useState(false)
  const [showActionSelector, setShowActionSelector] = useState(false)
  const [showSubmitErrorNote, setShowSubmitErrorNote] = useState(false)

  const proposalDescription = watch('description')
  const proposalTitle = watch('title')
  const proposalActionData = watch('actionData')

  const { append, remove } = useFieldArray({
    name: 'actionData',
    control,
    shouldUnregister: true,
  })

  const votingModuleActions = useVotingModuleActions()
  const proposalModuleActions = makeUseProposalModuleActions(proposalModule)()
  const actions = useActions(
    coreVersion,
    useMemo(
      () => [...votingModuleActions, ...proposalModuleActions],
      [proposalModuleActions, votingModuleActions]
    )
  )

  // Call relevant action hooks in the same order every time.
  const actionsWithData: Partial<
    Record<
      ActionKey,
      {
        action: Action
        transform: ReturnType<UseTransformToCosmos>
        defaults: ReturnType<UseDefaults>
      }
    >
  > = actions.reduce(
    (acc, action) => ({
      ...acc,
      [action.key]: {
        action,
        transform: action.useTransformToCosmos(coreAddress),
        defaults: action.useDefaults(coreAddress),
      },
    }),
    {}
  )

  // Detect if Mac for checking keypress.
  const { isMac } = usePlatform()
  // Keybinding to open add action selector.
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (
        // If already showing action selector, do nothing. This allows the
        // keybinding to function normally when the selector is open. The
        // escape keybinding can always be used to exit the modal.
        showActionSelector ||
        // Or if focused on an input.
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return
      }

      if ((!isMac && event.ctrlKey) || event.metaKey) {
        if (event.key === 'a') {
          event.preventDefault()
          setShowActionSelector(true)
        }
      }
    },
    [isMac, showActionSelector]
  )
  // Setup search keypress.
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  const setRefreshWalletBalancesId = useSetRecoilState(
    refreshWalletBalancesIdAtom(walletAddress ?? '')
  )
  const refreshBalances = useCallback(
    () => setRefreshWalletBalancesId((id) => id + 1),
    [setRefreshWalletBalancesId]
  )

  const cosmWasmClient = useRecoilValue(cosmWasmClientSelector)
  const onSubmit = useCallback(
    async (newProposalData: NewProposalData) => {
      if (
        !connected ||
        // If required deposit, ensure the allowance and unstaked balance
        // data have loaded.
        (requiredProposalDeposit && !allowanceResponse)
      ) {
        throw new Error(t('error.loadingData'))
      }

      setLoading(true)

      // Typecheck for TS; should've already been verified above.
      if (requiredProposalDeposit && allowanceResponse) {
        const remainingAllowanceNeeded =
          requiredProposalDeposit -
          // If allowance expired, none.
          (expirationExpired(allowanceResponse.expires, blockHeight)
            ? 0
            : Number(allowanceResponse.allowance))

        // Request to increase the contract's allowance for the proposal
        // deposit if needed.
        if (remainingAllowanceNeeded) {
          try {
            await increaseAllowance({
              amount: remainingAllowanceNeeded.toString(),
              spender: proposalModuleAddress,
            })

            // Allowances will not update until the next block has been added.
            setTimeout(refreshBalances, 6500)
          } catch (err) {
            console.error(err)
            toast.error(
              `Failed to increase allowance to pay proposal deposit: (${processError(
                err
              )})`
            )
            setLoading(false)
            return
          }
        }
      }

      try {
        const response = await createProposal(newProposalData)

        const proposalNumber = Number(
          findAttribute(response.logs, 'wasm', 'proposal_id').value
        )

        const proposalId = `${proposalModulePrefix}${proposalNumber}`

        const proposalInfo = await makeGetProposalInfo({
          proposalModule,
          proposalNumber,
          proposalId,
          coreAddress,
          Logo,
          Loader,
        })(cosmWasmClient)
        const expirationDate =
          proposalInfo &&
          convertExpirationToDate(proposalInfo.expiration, blockHeight)

        onCreateSuccess(
          proposalInfo
            ? {
                id: proposalId,
                title: formMethods.getValues('title'),
                description: formMethods.getValues('description'),
                info: expirationDate
                  ? [
                      {
                        Icon: Open,
                        label: dateToWdhms(expirationDate),
                      },
                    ]
                  : [],
              }
            : {
                id: proposalId,
                title: formMethods.getValues('title'),
                description: formMethods.getValues('description'),
                info: [],
              }
        )
        // Don't stop loading indicator since we are navigating.
      } catch (err) {
        console.error(err)
        toast.error(processError(err))
        setLoading(false)
      }
    },
    [
      connected,
      requiredProposalDeposit,
      allowanceResponse,
      t,
      blockHeight,
      increaseAllowance,
      proposalModuleAddress,
      refreshBalances,
      createProposal,
      proposalModulePrefix,
      proposalModule,
      coreAddress,
      Logo,
      Loader,
      cosmWasmClient,
      onCreateSuccess,
      formMethods,
    ]
  )

  const onSubmitForm: SubmitHandler<NewProposalForm> = useCallback(
    ({ actionData, ...data }, event) => {
      setShowSubmitErrorNote(false)

      const nativeEvent = event?.nativeEvent as SubmitEvent
      const submitterValue = (nativeEvent?.submitter as HTMLInputElement)?.value

      if (submitterValue === ProposeSubmitValue.Preview) {
        setShowPreview((p) => !p)
        return
      }

      onSubmit({
        ...data,
        msgs: actionData
          .map(({ key, data }) => actionsWithData[key]?.transform(data))
          // Filter out undefined messages.
          .filter(Boolean) as CosmosMsgFor_Empty[],
      })
    },
    [onSubmit, actionsWithData]
  )

  const onSubmitError: SubmitErrorHandler<NewProposalForm> = useCallback(
    () => setShowSubmitErrorNote(true),
    [setShowSubmitErrorNote]
  )

  return (
    <FormProvider {...formMethods}>
      <form
        className="max-w-[800px]"
        onSubmit={handleSubmit(onSubmitForm, onSubmitError)}
      >
        {showPreview && (
          <>
            <div className="max-w-prose">
              <h1 className="my-6 text-xl header-text">{proposalTitle}</h1>
            </div>
            <div className="mt-[22px] mb-[36px]">
              <MarkdownPreview markdown={proposalDescription} />
            </div>
            <CosmosMessageDisplay
              value={decodedMessagesString(
                proposalActionData
                  .map(({ key, data }) => actionsWithData[key]?.transform(data))
                  // Filter out undefined messages.
                  .filter(Boolean) as CosmosMsgFor_Empty[]
              )}
            />
          </>
        )}
        <div className={showPreview ? 'hidden' : ''}>
          <div className="flex flex-col gap-1 my-3">
            <InputLabel name={t('form.proposalTitle')} />
            <TextInput
              error={errors.title}
              fieldName="title"
              register={register}
              validation={[validateRequired]}
            />
            <InputErrorMessage error={errors.title} />
          </div>
          <div className="flex flex-col gap-1 my-3">
            <InputLabel name={t('form.proposalDescription')} />
            <TextAreaInput
              error={errors.description}
              fieldName="description"
              register={register}
              validation={[validateRequired]}
            />
            <InputErrorMessage error={errors.description} />
          </div>
          <ul className="list-none">
            {proposalActionData.map((actionData, index) => {
              const Component =
                actionsWithData[actionData.key]?.action?.Component
              if (!Component) {
                throw new Error(
                  `Error detecting action type "${actionData.key}".`
                )
              }

              return (
                <li key={index}>
                  <SuspenseLoader
                    fallback={<ActionCardLoader Loader={Loader} />}
                  >
                    <Component
                      Loader={Loader}
                      Logo={Logo}
                      allActionsWithData={proposalActionData}
                      coreAddress={coreAddress}
                      data={actionData.data}
                      errors={errors.actionData?.[index]?.data || {}}
                      fieldNamePrefix={`actionData.${index}.data.`}
                      index={index}
                      isCreating
                      onRemove={() => remove(index)}
                    />
                  </SuspenseLoader>
                </li>
              )
            })}
          </ul>
          <div className="mt-2">
            <ActionSelector
              actions={actions}
              onSelectAction={({ key }) => {
                append({
                  key,
                  data: actionsWithData[key]?.defaults ?? {},
                })
                setShowActionSelector(false)
              }}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          {connected ? (
            <Tooltip
              title={
                !isMember
                  ? t('error.mustBeMemberToCreateProposal')
                  : !canPayDeposit
                  ? t('error.notEnoughForDeposit')
                  : isPaused
                  ? t('error.daoIsPaused')
                  : undefined
              }
            >
              <Button
                disabled={!isMember || !canPayDeposit || isPaused}
                loading={loading}
                type="submit"
                value={ProposeSubmitValue.Submit}
              >
                {t('button.publishProposal') + ' '}
                <Airplane height="14px" width="14px" />
              </Button>
            </Tooltip>
          ) : (
            <ConnectWalletButton />
          )}
          <Button
            disabled={loading}
            type="submit"
            value={ProposeSubmitValue.Preview}
            variant="secondary"
          >
            {showPreview ? (
              <>
                {t('button.hidePreview')}
                <EyeOffIcon className="inline ml-2 h-5 stroke-current" />
              </>
            ) : (
              <>
                {t('button.preview')}
                <EyeIcon className="inline ml-2 h-5 stroke-current" />
              </>
            )}
          </Button>
        </div>
        {showSubmitErrorNote && (
          <p className="mt-2 text-right text-error secondary-text">
            {t('error.createProposalSubmitInvalid')}
          </p>
        )}
      </form>
    </FormProvider>
  )
}
