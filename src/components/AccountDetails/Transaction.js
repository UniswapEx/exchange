import React from 'react'
import styled from 'styled-components'
import { CheckCircle, Triangle } from 'react-feather'

import { useActiveWeb3React } from '../../hooks'
import { getEtherscanLink } from '../../utils'
// import { useAllTransactions } from '../../state/transactions/hooks'
// mport { RowFixed } from '../Row'
import Loader from '../Loader'
import { Link } from '../../theme'

const TransactionWrapper = styled.div``

const TransactionStatusText = styled.div`
  margin-right: 0.5rem;
  display: flex;
  align-items: center;
  :hover {
    text-decoration: underline;
  }
`

const TransactionState = styled(Link)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-decoration: none !important;
  border-radius: 0.5rem;
  padding: 0.25rem 0rem;
  font-weight: 500;
  font-size: 0.825rem;
  color: ${({ theme }) => theme.primary1};
`

const IconWrapper = styled.div`
  color: ${({ pending, success, theme }) => (pending ? theme.primary1 : success ? theme.green1 : theme.red1)};
`

export default function Transaction({ hash }) {
  const { chainId } = useActiveWeb3React()
  // const allTransactions = useAllTransactions()

  // const summary = allTransactions[hash].summary
  // const pending = !allTransactions[hash].receipt
  // const success =
  //   !pending &&
  //   (allTransactions[hash].receipt.status === 1 || typeof allTransactions[hash].receipt.status === 'undefined')

  return (
    <TransactionWrapper>
      {/* <TransactionState href={getEtherscanLink(chainId, hash, 'transaction')} pending={pending} success={success}>
        <RowFixed>
          <TransactionStatusText>{summary ? summary : hash} ↗</TransactionStatusText>
        </RowFixed>
        <IconWrapper pending={pending} success={success}>
          {pending ? <Loader /> : success ? <CheckCircle size="16" /> : <Triangle size="16" />}
        </IconWrapper>
      </TransactionState> */}
    </TransactionWrapper>
  )
}
