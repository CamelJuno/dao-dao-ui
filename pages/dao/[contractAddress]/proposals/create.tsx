import toast from 'react-hot-toast'

import { Breadcrumbs } from '@components/Breadcrumbs'
import { ProposalData, ProposalForm } from '@components/ProposalForm'
import type { NextPage } from 'next'
import { NextRouter, useRouter } from 'next/router'
import { useState } from 'react'
import { useRecoilValue } from 'recoil'
import {
  cosmWasmSigningClient,
  walletAddress as walletAddressSelector,
} from 'selectors/cosm'
import { daoSelector } from 'selectors/daos'
import { cw20TokenInfo } from 'selectors/treasury'
import { MessageTemplate, messageTemplates } from 'templates/templateList'
import { defaultExecuteFee } from 'util/fee'
import { cleanChainError } from 'util/cleanChainError'
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate'
import { findAttribute } from '@cosmjs/stargate/build/logs'

const ProposalCreate: NextPage = () => {
  const router: NextRouter = useRouter()
  const contractAddress = router.query.contractAddress as string
  const daoInfo = useRecoilValue(daoSelector(contractAddress))
  const tokenInfo = useRecoilValue(cw20TokenInfo(daoInfo.gov_token))

  const signingClient = useRecoilValue(cosmWasmSigningClient)
  const walletAddress = useRecoilValue(walletAddressSelector)

  const [proposalLoading, setProposalLoading] = useState(false)

  const onProposalSubmit = async (d: ProposalData) => {
    setProposalLoading(true)
    let cosmMsgs = d.messages.map((m: MessageTemplate) => {
      const toCosmosMsg = messageTemplates.find(
        (template) => template.label === m.label
      )?.toCosmosMsg

      // Unreachable.
      if (!toCosmosMsg) return {}

      return toCosmosMsg(m as any, {
        sigAddress: contractAddress,
        govAddress: daoInfo.gov_token,
        govDecimals: tokenInfo.decimals,
        multisig: false,
      })
    })

    if (daoInfo.config.proposal_deposit !== '0') {
      try {
        await signingClient?.execute(
          walletAddress,
          daoInfo.gov_token,
          {
            increase_allowance: {
              amount: daoInfo.config.proposal_deposit,
              spender: contractAddress,
            },
          },
          defaultExecuteFee
        )
      } catch (e: any) {
        toast.error(
          `failed to increase allowance to pay proposal deposit: (${cleanChainError(
            e.message
          )})`
        )
        return
      }
    }

    await signingClient
      ?.execute(
        walletAddress,
        contractAddress,
        {
          propose: {
            title: d.title,
            description: d.description,
            msgs: cosmMsgs,
          },
        },
        defaultExecuteFee
      )
      .catch((e) => {
        toast.error(cleanChainError(e.message))
      })
      .then((response: void | ExecuteResult) => {
        if (!response) {
          return
        }
        const proposalId = findAttribute(
          response.logs,
          'wasm',
          'proposal_id'
        ).value
        router.push(`/dao/${contractAddress}/proposals/${proposalId}`)
      })
      .finally(() => setProposalLoading(false))
  }

  return (
    <div className="grid grid-cols-6">
      <div className="w-full col-span-4 p-6">
        <Breadcrumbs
          crumbs={[
            ['/starred', 'Home'],
            [`/dao/${contractAddress}`, daoInfo.config.name],
            [router.asPath, `New proposal`],
          ]}
        />
        <ProposalForm
          onSubmit={onProposalSubmit}
          contractAddress={contractAddress}
          loading={proposalLoading}
        />
      </div>
      <div className="col-span-2 p-6 bg-base-200 min-h-screen"></div>
    </div>
  )
}

export default ProposalCreate
