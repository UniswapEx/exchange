import React, { useState, useEffect, useRef } from 'react'
import ReactGA from 'react-ga'
import { useTranslation } from 'react-i18next'
import styled, { css, keyframes } from 'styled-components'
import { darken, lighten } from 'polished'
import { ethers } from 'ethers'

import { isAddress, amountFormatter } from '../../utils'
import { useDebounce } from '../../hooks'

import question from '../../assets/images/question.svg'

import NewContextualInfo from '../../components/ContextualInfoNew'

const EXECUTE_ORDER_GAS_USAGE = '300000' // 300,000 GAS

const WARNING_TYPE = Object.freeze({
  none: 'none',
  noSend: 'noSend',
  almostNoSend: 'almostNoSend'
})

const Flex = styled.div`
  display: flex;
  justify-content: center;
`

const FlexBetween = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
`

const WrappedSlippageRow = ({ wrap, ...rest }) => <Flex {...rest} />
const SlippageRow = styled(WrappedSlippageRow)`
  position: relative;
  flex-wrap: ${({ wrap }) => wrap && 'wrap'};
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  padding: 0;
  padding-top: ${({ wrap }) => wrap && '0.25rem'};
`

const QuestionWrapper = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  margin-left: 0.4rem;
  padding: 0.2rem;
  border: none;
  background: none;
  outline: none;
  cursor: default;
  border-radius: 36px;

  :hover,
  :focus {
    opacity: 0.7;
  }
`

const HelpCircleStyled = styled.img`
  height: 18px;
  width: 18px;
`

const fadeIn = keyframes`
  from {
    opacity : 0;
  }

  to {
    opacity : 1;
  }
`

const Popup = styled(Flex)`
  position: absolute;
  width: 300px;
  left: -78px;
  top: -135px;
  flex-direction: column;
  align-items: center;
  padding: 0.6rem 1rem;
  line-height: 150%;
  background: ${({ theme }) => theme.inputBackground};
  border: 1px solid ${({ theme }) => theme.mercuryGray};

  border-radius: 8px;

  animation: ${fadeIn} 0.15s linear;

  color: ${({ theme }) => theme.textColor};
  font-style: italic;

  ${({ theme }) => theme.mediaWidth.upToSmall`
    left: -20px;
  `}
`

const FancyButton = styled.button`
  color: ${({ theme }) => theme.textColor};
  align-items: center;
  min-width: 55px;
  height: 2rem;
  border-radius: 36px;
  font-size: 12px;
  border: 1px solid ${({ theme }) => theme.mercuryGray};
  outline: none;
  background: ${({ theme }) => theme.inputBackground};

  :hover {
    cursor: inherit;
    border: 1px solid ${({ theme }) => theme.chaliceGray};
  }
  :focus {
    border: 1px solid ${({ theme }) => theme.royalGreen};
  }
`

const Option = styled(FancyButton)`
  margin-right: 8px;
  margin-top: 6px;

  :hover {
    cursor: pointer;
  }

  ${({ active, theme }) =>
    active &&
    css`
      background-color: ${({ theme }) => theme.royalGreen};
      color: ${({ theme }) => theme.white};
      border: none;

      :hover {
        border: none;
        box-shadow: none;
        background-color: ${({ theme }) => darken(0.05, theme.royalGreen)};
      }

      :focus {
        border: none;
        box-shadow: none;
        background-color: ${({ theme }) => lighten(0.05, theme.royalGreen)};
      }

      :active {
        background-color: ${({ theme }) => darken(0.05, theme.royalGreen)};
      }

      :hover:focus {
        background-color: ${({ theme }) => theme.royalGreen};
      }
      :hover:focus:active {
        background-color: ${({ theme }) => darken(0.05, theme.royalGreen)};
      }
    `}
`

const OptionLarge = styled(Option)`
  width: 120px;
`

const Input = styled.input`
  background: ${({ theme }) => theme.inputBackground};
  flex-grow: 1;
  font-size: 12px;

  outline: none;
  box-sizing: border-box;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }

  cursor: inherit;

  color: ${({ theme }) => theme.doveGray};
  text-align: left;
  ${({ active }) =>
    active &&
    css`
      color: initial;
      cursor: initial;
      text-align: right;
    `}

  ${({ placeholder }) =>
    placeholder !== 'Custom' &&
    css`
      text-align: right;
      color: ${({ theme }) => theme.textColor};
    `}

  ${({ color }) =>
    color === 'red' &&
    css`
      color: ${({ theme }) => theme.salmonRed};
    `}
`

const BottomError = styled.div`
  ${({ show }) =>
    show &&
    css`
      padding-top: 12px;
    `}
  color: ${({ theme }) => theme.doveGray};
  ${({ color }) =>
    color === 'red' &&
    css`
      color: ${({ theme }) => theme.salmonRed};
    `}
`

const OptionCustom = styled(FancyButton)`
  height: 2rem;
  position: relative;
  width: 120px;
  margin-top: 6px;
  padding: 0 0.75rem;

  ${({ active }) =>
    active &&
    css`
      border: 1px solid ${({ theme }) => theme.royalGreen};
      :hover {
        border: 1px solid ${({ theme }) => darken(0.1, theme.royalGreen)};
      }
    `}

  ${({ color }) =>
    color === 'red' &&
    css`
      border: 1px solid ${({ theme }) => theme.salmonRed};
    `}

  input {
    width: 100%;
    height: 100%;
    border: 0px;
    border-radius: 2rem;
  }
`

const Bold = styled.span`
  font-weight: 500;
`

const LastSummaryText = styled.div`
  padding-top: 0.5rem;
`

const SlippageSelector = styled.div`
  background-color: ${({ theme }) => darken(0.04, theme.concreteGray)};
  padding: 1rem 1.25rem 1rem 1.25rem;
  border-radius: 12px;
`

const Percent = styled.div`
  color: inherit;
  font-size: 0, 8rem;
  flex-grow: 0;

  ${({ color, theme }) =>
    (color === 'faded' &&
      css`
        color: ${theme.doveGray};
      `) ||
    (color === 'red' &&
      css`
        color: ${theme.salmonRed};
      `)};
`

const Faded = styled.span`
  opacity: 0.7;
`

const TransactionInfo = styled.div`
  padding: 1.25rem 1.25rem 1rem 1.25rem;
`

const ValueWrapper = styled.span`
  padding: 0.125rem 0.3rem 0.1rem 0.3rem;
  background-color: ${({ theme }) => darken(0.04, theme.concreteGray)};
  border-radius: 12px;
  font-variant: tabular-nums;
`

export default function TransactionDetails(props) {
  const { t } = useTranslation()

  const [activeIndex, setActiveIndex] = useState(2)

  const [warningType, setWarningType] = useState(WARNING_TYPE.none)

  const inputRef = useRef()

  const [showPopup, setPopup] = useState(false)

  const [userInput, setUserInput] = useState('')

  const debouncedInput = useDebounce(userInput, 150)

  useEffect(() => {
    if (activeIndex === 4) {
      setFromFixed(4, debouncedInput)
    }
  })

  function renderSummary() {
    let contextualInfo = ''
    let isError = false

    if (props.inputError || props.independentError) {
      contextualInfo = props.inputError || props.independentError
      isError = true
    } else if (!props.inputCurrency || !props.outputCurrency) {
      contextualInfo = t('selectTokenCont')
    } else if (!props.independentValue) {
      contextualInfo = t('enterValueCont')
    } else if (props.sending && !props.recipientAddress) {
      contextualInfo = t('noRecipient')
    } else if (props.sending && !isAddress(props.recipientAddress)) {
      contextualInfo = t('invalidRecipient')
    } else if (!props.account) {
      contextualInfo = t('noWallet')
      isError = true
    }

    const slippageWarningText = props.highSlippageWarning
      ? t('highSlippageWarning')
      : props.slippageWarning
      ? t('slippageWarning')
      : ''

    return (
      <NewContextualInfo
        openDetailsText={t('transactionDetails')}
        closeDetailsText={t('hideDetails')}
        contextualInfo={contextualInfo ? contextualInfo : slippageWarningText}
        allowExpand={
          !!(
            props.inputCurrency &&
            props.outputCurrency &&
            props.inputValueParsed &&
            props.outputValueParsed &&
            (props.sending ? props.recipientAddress : true)
          )
        }
        isError={isError}
        slippageWarning={props.slippageWarning && !contextualInfo}
        highSlippageWarning={props.highSlippageWarning && !contextualInfo}
        renderTransactionDetails={renderTransactionDetails}
        dropDownContent={dropDownContent}
      />
    )
  }

  const dropDownContent = () => {
    return (
      <>
        {renderTransactionDetails()}
        <SlippageSelector>
          <SlippageRow>
            {t('gasPrice')}
            <QuestionWrapper
              onClick={() => {
                setPopup(!showPopup)
              }}
              onMouseEnter={() => {
                setPopup(true)
              }}
              onMouseLeave={() => {
                setPopup(false)
              }}
            >
              <HelpCircleStyled src={question} alt="popup" />
            </QuestionWrapper>
            {showPopup ? (
              <Popup>
                {t('feeFaq')}
              </Popup>
            ) : (
              ''
            )}
          </SlippageRow>
          <SlippageRow wrap>
            <Option
              onClick={() => {
                setFromFixed(1, 10)
              }}
              active={activeIndex === 1}
            >
              10
            </Option>
            <OptionLarge
              onClick={() => {
                setFromFixed(2, 20)
              }}
              active={activeIndex === 2}
            >
              20 <Faded>(suggested)</Faded>
            </OptionLarge>
            <Option
              onClick={() => {
                setFromFixed(3, 40)
              }}
              active={activeIndex === 3}
            >
              40
            </Option>
            <OptionCustom
              active={activeIndex === 4}
              color={warningType === WARNING_TYPE.noSend ? 'red' : ''}
              onClick={() => {
                setFromCustom()
              }}
            >
              <FlexBetween>
                {warningType !== WARNING_TYPE.none && (
                  <span role="img" aria-label="warning">
                    ⚠️
                  </span>
                )}
                <Input
                  tabIndex={-1}
                  ref={inputRef}
                  active={activeIndex === 4}
                  placeholder={
                    activeIndex === 4
                      ? !!userInput
                        ? ''
                        : '0'
                      : activeIndex !== 4 && userInput !== ''
                      ? userInput
                      : 'Custom'
                  }
                  value={activeIndex === 4 ? userInput : ''}
                  onChange={parseInput}
                  color={warningType === WARNING_TYPE.noSend ? 'red' : ''}
                />
                <Percent
                  color={activeIndex !== 4 ? 'faded' : warningType === WARNING_TYPE.noSend ? 'red' : ''}
                ></Percent>
              </FlexBetween>
            </OptionCustom>
          </SlippageRow>
          <SlippageRow>
            <BottomError
              show={activeIndex === 4}
              color={warningType === WARNING_TYPE.emptyInput ? '' : warningType === WARNING_TYPE.noSend ? 'red' : ''}
            >
              {activeIndex === 4 && warningType.toString() === 'none' && t('customGasPrice')}
              {warningType === WARNING_TYPE.noSend && t('notExecuted')}
              {warningType === WARNING_TYPE.almostNoSend && t('mayNotExecuted')}
            </BottomError>
          </SlippageRow>
        </SlippageSelector>
      </>
    )
  }

  const setFromCustom = () => {
    inputRef.current.focus()
    // if there's a value, evaluate the bounds
    setFromFixed(4, debouncedInput)
  }

  // used for slippage presets
  const setFromFixed = (index, gasPrice) => {
    if (gasPrice < 1) {
      setWarningType(WARNING_TYPE.noSend)
    } else if (gasPrice < 5) {
      setWarningType(WARNING_TYPE.almostNoSend)
    } else {
      setWarningType(WARNING_TYPE.none)
    }
    setActiveIndex(index)
    const newFee = EXECUTE_ORDER_GAS_USAGE * gasPrice * 1e9 || 0
    props.setFee(newFee)
  }

  // check that the theyve entered number and correct decimal
  const parseInput = e => {
    let input = e.target.value
    setUserInput(input)
  }

  const b = text => <Bold>{text}</Bold>

  const renderTransactionDetails = () => {
    ReactGA.event({
      category: 'TransactionDetail',
      action: 'Open'
    })

    return (
      <TransactionInfo>
        <div>
          {t('feeSet')}
          <ValueWrapper>
            {b(`${amountFormatter(ethers.utils.bigNumberify(props.fee.toString()), 18, 4)} ETH`)}
          </ValueWrapper>
          {t('toTheRelayer')}
        </div>
        <LastSummaryText>
          {t('relayerFee')} <ValueWrapper>{b(`${props.fee / 1e9 / EXECUTE_ORDER_GAS_USAGE} GWEI`)}</ValueWrapper>
        </LastSummaryText>
      </TransactionInfo>
    )
  }
  return <>{renderSummary()}</>
}
