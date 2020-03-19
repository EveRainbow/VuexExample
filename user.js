import api from 'api/index'
import { detectUserBrowser } from 'utils'

const initialState = {
  Username: '',
  Authorized: 0,
  URLTo1C: '',
  ComponentTree: '',
  flattenTree: '',
  VisibleURLTo1C: '',
  PortalName: '',
  Copyright: '',
  CheckPhoto: null,
  HasPhoto: null,
  Photo: '',
  serverTimeDelta: null
}

export default {
  namespaced: true,
  state: {
    user: Object.assign({}, initialState)
  },
  mutations: {
    setUser(state, payload) {
      const flattenTree = (children, result = [], parent) => {
        for (let i = 0; i < children.length; i++) {
          result.push({
            ...children[i],
            Parent: parent
          })
          if (children[i].Children) {
            flattenTree(children[i].Children, result, (parent = children[i]))
          }
        }
        return result
      }
      state.user.flattenTree = payload.ComponentTree && flattenTree(payload.ComponentTree)
      Object.assign(state.user, payload)
    },
    removeUser(state) {
      let copyright = state.user.Copyright
      state.user = Object.assign({}, initialState, { Copyright: copyright })
    },
    setCopyright(state, payload) {
      state.user.Copyright = payload
    },
    changeUserPhotoStatus(state, payload) {
      state.user.HasPhoto = payload
    },
    setAvatar(state, payload) {
      state.user.Photo = payload
    },
    setTimeDelta(state, { delta }) {
      state.user.serverTimeDelta = delta
    }
  },
  actions: {
    login(state, payload) {
      return api.auth(payload)
    },
    logout({ commit }) {
      return null
    },
    getUser({ commit }) {
      return api.getUser({
        // параметры передаются в getUser
        Screen: {
          Width: window.screen.width,
          Height: window.screen.height
        },
        Viewport: {
          Width: window.innerWidth,
          Height: window.innerHeight
        },
        Browser: detectUserBrowser()
      })
    },
    setNewAvatar({ commit }, payload) {
      commit('setAvatar', payload)
    }
  },
  getters: {
    getUser: ({ user }) => user,
    getTree: ({ user }) => user.ComponentTree
  }
}
