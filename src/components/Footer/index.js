import React from 'react'
import styled from 'styled-components'
import { darken, transparentize } from 'polished'
import Toggle from 'react-switch'

import { Link } from '../../theme'
import { useDarkModeManager } from '../../contexts/LocalStorage'
import SVGDiscord from '../../assets/svg/SVGDiscord'
import SVGTelegram from '../../assets/svg/SVGTelegram'

const FooterFrame = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

const FooterElement = styled.div`
  margin: 1.25rem;
  display: flex;
  min-width: 0;
  display: flex;
  align-items: center;
`

const Title = styled.div`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.uniswapPink};

  :hover {
    cursor: pointer;
  }
  #link {
    text-decoration-color: ${({ theme }) => theme.uniswapPink};
  }

  #title {
    display: inline;
    font-size: 0.825rem;
    margin-right: 12px;
    font-weight: 400;
    color: ${({ theme }) => theme.uniswapPink};
    :hover {
      color: ${({ theme }) => darken(0.2, theme.uniswapPink)};
    }
  }
`

const StyledToggle = styled(Toggle)`
  margin-right: 24px;

  .react-switch-bg[style] {
    background-color: ${({ theme }) => darken(0.05, theme.inputBackground)} !important;
    border: 1px solid ${({ theme }) => theme.concreteGray} !important;
  }

  .react-switch-handle[style] {
    background-color: ${({ theme }) => theme.inputBackground};
    box-shadow: 0 4px 8px 0 ${({ theme }) => transparentize(0.93, theme.shadowColor)};
    border: 1px solid ${({ theme }) => theme.mercuryGray};
    border-color: ${({ theme }) => theme.mercuryGray} !important;
    top: 2px !important;
  }
`

const EmojiToggle = styled.span`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-family: Arial sans-serif;
`

const DiscordImg = styled.div`
  height: 18px;

  svg {
    fill: ${({ theme }) => theme.uniswapPink};
    height: 28px;
  }
`

const TelegramImg = styled.div`
  height: 18px;
  margin-left: 5px;
  svg {
    fill: ${({ theme }) => theme.uniswapPink};
    height: 22px;
  }
`

export default function Footer() {
  const [isDark, toggleDarkMode] = useDarkModeManager()

  return (
    <FooterFrame>
      <FooterElement>
        <Title>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://github.com/UniswapEx/exchange#how-it-works">
            <h1 id="title">About</h1>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://github.com/UniswapEx/exchange">
            <h1 id="title">Code</h1>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://v1.uniswapex.io/">
            <h1 id="title">UniswapEx V1</h1>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://gitcoin.co/grants/765/uniswapex-v2">
            <h1 id="title">Donate ❤</h1>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://discord.gg/w6JVcrg">
            <DiscordImg>
              <SVGDiscord />
            </DiscordImg>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://t.me/UniswapEX">
            <TelegramImg>
              <SVGTelegram />
            </TelegramImg>
          </Link>
        </Title>
      </FooterElement>

      <StyledToggle
        checked={!isDark}
        uncheckedIcon={
          <EmojiToggle role="img" aria-label="moon">
            {/* eslint-disable-line jsx-a11y/accessible-emoji */}
            🌙️
          </EmojiToggle>
        }
        checkedIcon={
          <EmojiToggle role="img" aria-label="sun">
            {/* eslint-disable-line jsx-a11y/accessible-emoji */}
            {'☀️'}
          </EmojiToggle>
        }
        onChange={() => toggleDarkMode()}
      />
    </FooterFrame>
  )
}
