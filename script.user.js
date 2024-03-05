// ==UserScript==
// @name         Monarch Money UI Tweaks
// @namespace    https://github.com/tlrdstd/
// @version      2024-03-02
// @description  Tweak the Monarch Money UI for greater personal satisfaction.
// @author       tlrdstd
// @match        https://app.monarchmoney.com/transactions*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @require      https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  const ENABLE_DEBUG_LOGS = true
  const AUTHORIZATION_TOKEN = JSON.parse(JSON.parse(localStorage.getItem('persist:root')).user).token

  const log = (...args) => {
    if (ENABLE_DEBUG_LOGS) {
      console.log('[uiTweaks] ', ...args)
    }
  }

  const addStyles = (styles) => {
    const styleSheet = document.createElement('style')
    styleSheet.innerText = styles
    document.head.appendChild(styleSheet)
  }

  class HideReferralButtonTweak {
    static Activate = () => {
      const styles = `
        div[class*="SideBar__Root-"] {
          a[class*="ReferralLinkButton__YellowLink"] {
            display: none;
          }
        }
      `

      addStyles(styles)
    }
  }

  class AdvancedTransactionsTweak {
    static Styles = `
      .uiTweaks__TransactionRow__Activated {
        div[class*="TransactionOverview__Name-"] {
          /* flex: 0 1 40%; */
        }

        div[class*="TransactionOverview__Category-"] {
          /* flex: 1 1 20%; */
        }

        div[class*="TransactionOverview__Amount-"] {
          /* flex: 1 1 30%; */
        }

        div[class*="TransactionOverview__Chevron"] {
          /* flex: 1 1 auto; */
        }
    `

    static Activate = () => {
      const monitorForTransactionRows = () => {
        // trigger an event handler whenever the document body updates
        // TODO: observe a smaller subset of nodes?
        VM.observe(document.body, () => {
          const rows = document.querySelectorAll('[class*="TransactionOverview__Root"]:not(.uiTweaks__TransactionRow__Activated)') // top-level row
        
          // if (rows.length) { log(`monitorForTransactionRows - found ${rows.length} rows`) }
          rows.forEach(row => new AdvancedTransactionsTweak.TransactionRow(row))

          // never disconnect observer - always scan on every DOM update
          return false
        })
      }

      addStyles(AdvancedTransactionsTweak.Styles)
      addStyles(AdvancedTransactionsTweak.TransactionNote.Styles)
      monitorForTransactionRows()
    }
  }

  AdvancedTransactionsTweak.TransactionRow = class {
    constructor(row) {
      this.row = row
      this.row.classList.add('uiTweaks__TransactionRow__Activated')
      this.react = Object.entries(this.row).find(([key, value]) => key.startsWith('__reactFiber$'))[1]

      this.transactionNote = new AdvancedTransactionsTweak.TransactionNote(this.getAmountColumn(), this.getTransactionData())
      log(this.row, this.getTransactionData())
    }

    getNameColumn() {
      // return this.nameColumn = this.nameColumn || this.row.querySelector('.' + this.react.memoizedProps.children[1].type.styledComponentId)
      return this.nameColumn = this.nameColumn || this.row.querySelector('[class*="TransactionOverview__Name"]')
    }

    getCategoryColumn() {
      return this.nameColumn = this.nameColumn || this.row.querySelector('[class*="TransactionOverview__Category"]')
    }

    getAmountColumn() {
      return this.nameColumn = this.nameColumn || this.row.querySelector('[class*="TransactionOverview__Amount"]')
    }

    getChevronColumn() {
      return this.nameColumn = this.nameColumn || this.row.querySelector('[class*="TransactionOverview__Chevron"]')
    }

    getTransactionData() {
      if (this.transactionData) {
        return this.transactionData
      }

      let parentReactNode = this.react.return
      while (parentReactNode.memoizedProps.transaction == null) {
        parentReactNode = parentReactNode.return
      }

      return this.transactionData = parentReactNode.memoizedProps.transaction
    }
  }

  AdvancedTransactionsTweak.TransactionNote = class {
    static Styles = `
      .uiTweaks__TransactionNote__Activated {
        div[class*="TransactionOverview__Icons-"] {
          display: none;
        }
      }

      .uiTweaks__TransactionNote__Column {
        font-size: smaller;
        flex: 1 1 30%;


        /* TODO: disable if the editing of pending transasctions is disabled - inspect nearby DOM? check household preferences? */
        .uiTweaks__TransactionNote__Editor {
          width: 100%;
          padding: 7px 12px;
          border: 1px solid;
          border-color: transparent;
          border-radius: 4px;
          transition: all 0.1s ease-out 0s;
          appearance: none;
          background: transparent;
          /* font-size: 16px; */
          line-height: 150%;
          color: rgb(255, 255, 255);

          &::placeholder {
            filter: brightness(130%);
          }

          &:hover, &:focus {
            transition: none;
            border-color: rgb(38, 61, 95);
          }
        }
      }
    `

    constructor(amountColumn, transactionData) {
      this.amountColumn = amountColumn
      this.transactionData = transactionData
      // log(this.amountColumn, transactionData)

      this.noteContent = this.amountColumn.querySelector('[class*="TransactionOverview__Icons"]').textContent

      this.amountColumn.classList.add('uiTweaks__TransactionNote__Activated')

      this.noteColumn = document.createElement('div')
      this.noteColumn.className = 'uiTweaks__TransactionNote__Column'

      this.noteEditor = document.createElement('input')
      this.noteEditor.className = 'uiTweaks__TransactionNote__Editor'
      this.noteEditor.placeholder = 'Notes'
      this.noteEditor.value = this.noteContent

      this.noteColumn.prepend(this.noteEditor)
      this.amountColumn.insertAdjacentElement('beforebegin', this.noteColumn)
      this.noteEditor.onblur = this.exitEditMode.bind(this)
    }

    exitEditMode() {
      if (this.noteEditor.value == this.noteContent) {
        // nothing to do - the note didn't change
        return
      }

      // capture current state
      this.noteContent = this.noteEditor.value
      // tell Monarch we changed things
      this.submitTransactionUpdateRequest()
    }

    submitTransactionUpdateRequest() {
        // TODO: learn about GraphQL queries - can I make this query more concise?
        const updateTransactionRequestQuery = `
          mutation Web_TransactionDrawerUpdateTransaction($input: UpdateTransactionMutationInput!) {
            updateTransaction(input: $input) {
              errors {
                ...PayloadErrorFields
                __typename
              }
              __typename
            }
          }

          fragment PayloadErrorFields on PayloadError {
            fieldErrors {
              field
              messages
              __typename
            }
            message
            code
            __typename
          }
        `

        const updateTransactionRequest = {
          operationName: "Web_TransactionDrawerUpdateTransaction",
          variables: {
            input: {
              id: this.transactionData.id,
              notes: this.noteContent,
            },
          },
          query: updateTransactionRequestQuery,
        }

        fetch("https://api.monarchmoney.com/graphql", {
          headers: {
            "authorization": `Token ${AUTHORIZATION_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(updateTransactionRequest),
          method: "POST",
        })
    }
  }

  class PersistentSidebarStateTweak {
    static Activate = () => {
      const styles = `
        .uiTweaks__PersistentSidebar__Hidden {
          div[class*="SideBar__Root-"] {
            width: 0;
          }
        }
      `

      const togglePersistentSidebarState = (e) => {
        const currentState = localStorage.getItem('uiTweaks__PersistentSidebar__Hidden')
        const toggledState = currentState == 'hidden' ? 'visible' : 'hidden'
        localStorage.setItem('uiTweaks__PersistentSidebar__Hidden', toggledState)

        applyPersistentSidebarState()
        e.stopPropagation() // prevent the default Monarch Money toggle sidebar event from firing
      }

      const applyPersistentSidebarState = () => {
        const shouldBeHidden = localStorage.getItem('uiTweaks__PersistentSidebar__Hidden') == 'hidden'
        log('applyPersistentSidebarState - shouldBeHidden:', shouldBeHidden)

        // apply the class to document.body to ensure it's in place before the DOM ever loads - this prevents an unsightly flash of sidebar
        document.body.classList.toggle('uiTweaks__PersistentSidebar__Hidden', shouldBeHidden)
      }

      const enablePersistentSidebarState = () => {
        applyPersistentSidebarState()

        VM.observe(document.body, () => {
          const sidebarButton = document.querySelector('button[class*="Header__ToggleSidebarButton"')
          if (sidebarButton) {
            sidebarButton.onclick = togglePersistentSidebarState
            return true // stop monitoring the DOM
          }
        })
      }

      addStyles(styles)
      enablePersistentSidebarState()
    }
  }

  // this GM script runs before the DOM loads to ensure
  // we can inject our styles as early as possible.
  // but that means we actually run before document.body exists,
  // so we have to delay a bit before actually doing anything.
  const onBodyReady = (handler) => {
    if (document.body) {
      handler()
      return
    }

    // repeat this function every 1hz until it runs the handler() and exits
    window.requestAnimationFrame(() => onBodyReady(handler))
  }

  onBodyReady(() => {
    PersistentSidebarStateTweak.Activate()
    HideReferralButtonTweak.Activate()
    AdvancedTransactionsTweak.Activate()
  })
})();
