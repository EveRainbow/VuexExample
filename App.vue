<template>
  <div id="app" v-if="isLoadComplete">
    <infoDialog
      v-if="infoMessage"
      :info="infoMessage"
      :visible="infoMessageIsVisible"
      @close="toggleInfoMessage"
    />
    <scrollbar observer is-body>
      <div id="page-top"></div>
      <template v-if="user.Authorized && appReady">
        <keep-alive>
          <router-view name="sidebar"/>
        </keep-alive>
        <div class="page-container" :class="homePadding" id="page-container">
          <div class="sidebar-backdrop" @click="closeSubmenu"></div>
          <template v-if="$route">
            <keep-alive v-if="$route">
              <router-view :key="$route.meta.Section"/>
            </keep-alive>
            <transition name="fade">
              <div class="page-loader-overlay" v-if="sectionLoadStart">
                <i class="el-icon-loading"></i>
              </div>
            </transition>
          </template>
          <errors
            v-else
            status="404"
            type-element="Page"
          />
          <Cfooter v-if="$route.name !== 'home'"/>
        </div>
        <textError/>
        <ideaDialog/>
        <searchDetail/>
      </template>
      <transition
        @before-enter="beforeEnterLogin"
        @leave="leaveLogin">
        <login v-if="!user.Authorized"/>
      </transition>
    </scrollbar>
    <VersionMismatch/>
  </div>
  <div v-else class="global-loader"><i class="el-icon-loading"></i></div>
</template>

<script>
  // TODO: need refactor
  import Sidebar from 'components/common/Page/Sidebar.vue'
  import Login from 'components/pages/main/Login.vue'
  import Cfooter from 'components/tpl-include/Footer.vue'
  import Home from 'components/pages/main/Home.vue'
  import { event } from 'utils/event'
  import { mapActions, mapMutations, mapGetters } from 'vuex'
  import Velocity from 'velocity-animate'
  import { registerRoutes } from './router'
  import textError from 'components/dialogs/Text.vue'
  import searchDetail from 'components/dialogs/Search-dialog.vue'
  import dialogHelper from 'components/dialogs/Dialog-helper.vue'
  import ideaDialog from 'components/dialogs/Idea-dialog.vue'
  import infoDialog from 'components/dialogs/Info-dialog.vue'
  import { Notification } from 'element-ui'
  import VersionMismatch from 'components/dialogs/VersionMismatch.vue'
  import { treeToRoutes } from './router/utils'
  import Scrollbar from 'components/common/Scrollbar/Scrollbar.vue'

  function filterTree(componentTree, sections) {
    const pagesByNewModel = componentTree.filter(s => sections.indexOf(s.Signature) !== -1)
    componentTree = componentTree.filter(s => sections.indexOf(s.Signature) === -1)
    return {
      pagesByNewModel,
      componentTree
    }
  }

  export default {
    name: 'App',
    data() {
      return {
        appReady: false,
        error500: false,
        errorVisible: false,
        isLoadComplete: false,
        sectionLoadStart: false,
        unauthorizedMessage: null,
        infoMessages: [],
        infoMessageCount: 0,
        infoMessageIsVisible: false,
        RequestsRefreshTime: 30
      }
    },
    created() {
      event.on({
        'app:ready': (user) => {
          this.getProducts().then(() => {
            this.setUser(user)
            if (user.CheckPhoto && !user.HasPhoto) {
              this.$alert('Для продолжения работы, пожалуйста, загрузите фотографию', 'Отсутствует фотография', {
                type: 'warning',
                confirmButtonText: 'OK'
              })
            }
            const defaultRoutes = [
              {
                path: '',
                components: {
                  default: Home,
                  sidebar: Sidebar
                },
                name: 'home',
                props: {
                  $tree: {
                    Signature: 'cfc'
                  }
                }
              },
              {
                path: '*',
                redirect: '/404'
              }
            ]
            let { pagesByNewModel, componentTree } = filterTree(user.ComponentTree, ['cfc.products'])
            let routes = registerRoutes(componentTree)
            let transitions = 0
            this.$router.addRoutes(routes.concat(defaultRoutes, treeToRoutes(pagesByNewModel)))
            this.$router.afterEach((to, from) => {
              if (transitions || to.path === from.path) {
                return
              }
              this.setTooltips(this.user.Tooltips, 'FirstTransition')
              transitions++
            })
            this.RequestsRefreshTime = user.hasOwnProperty('RequestsRefreshTime') && parseInt(user.RequestsRefreshTime) > 30
              ? parseInt(user.RequestsRefreshTime)
              : this.RequestsRefreshTime
            this.updateNotifications()
            this.isLoadComplete = true
          })
        },
        'app:init': () => {
          this.init(null)
        },
        'app:showServerError': () => {
          this.showServerError()
        },
        'app:showUnauthorizedMessage': () => {
          this.showUnauthorizedMessage()
        },
        'section:load-start': (load) => {
          this.sectionLoadStart = load
        },
        logout: () => {
          this.logoutUser()
            .then(() => window.location.reload())
        }
      })
    },
    mounted() {
      this.checkSessionExpired()
      this.init(() => {
        this.appReady = true
      })
    },
    computed: {
      ...mapGetters({
        user: 'user/getUser',
        tree: 'user/getTree'
      }),
      homePadding() {
        return this.$route.name === 'home' ? 'pb-0' : ''
      },
      infoMessage() {
        return this.infoMessages[this.infoMessageCount]
      }
    },
    methods: {
      ...mapActions({
        getUser: 'user/getUser',
        logoutUser: 'user/logout',
        getProducts: 'productsList/getProducts',
        getNotifications: 'notifications/getNotifications'
      }),
      ...mapMutations({
        setUser: 'user/setUser'
      }),
      closeSubmenu() {
        event.emit('sidebarMenu:close')
      },
      /* setDialogHelperTooltips(payload) {
        event.emit('Dialog-helper:setdata', payload)
      }, */
      setTooltips(tooltips, trigger = 'FirstLoad') {
        if (tooltips && tooltips.length) {
          this.infoMessageIsVisible = false
          this.infoMessageCount = 0
          setTimeout(() => {
            this.infoMessages = tooltips.filter(item => item.Trigger === trigger)
            this.infoMessageIsVisible = true
          }, 1000)
        }
      },
      toggleInfoMessage() {
        this.infoMessageIsVisible = false
        setTimeout(() => {
          this.infoMessageCount++
          this.infoMessageIsVisible = true
        }, 200)
      },
      checkSessionExpired() {
        let sessionExpired = localStorage.getItem('sessionExpired')
        let currTime = new Date().getTime()
        if (sessionExpired && sessionExpired !== 'false') {
          let expTime = new Date(Number(sessionExpired)).getTime()
          if ((currTime - expTime) / 1000 < 360) this.showUnauthorizedMessage()
        }
      },
      showUnauthorizedMessage() {
        if (this.unauthorizedMessage) return false
        this.unauthorizedMessage = Notification({
          title: 'Ваша сессия истекла',
          customClass: 'session-expired-dialog',
          type: 'warning',
          duration: 0,
          message: 'Введите логин и пароль для повторной авторизации',
          onClose: () => {
            this.unauthorizedMessage = ''
          }
          // onClick: () => event.emit('logout')
        })
      },
      hideUnauthorizedMessage() {
        localStorage.setItem('sessionExpired', 'false')
        if (this.unauthorizedMessage) this.unauthorizedMessage.close()
      },
      showServerError() {
        if (this.errorVisible) return false
        this.errorVisible = true
        Notification({
          title: 'Ошибка сервера',
          customClass: 'errorDialogPointer',
          type: 'error',
          message: 'Попробуйте еще раз или обратитесь в техподдержку портала',
          onClose: () => { this.errorVisible = false }
          /* onClick: () => window.location.reload() */
        })
      },
      async init(cb) {
        try {
          let user = await this.getUser()

          if (!user.Authorized) {
            user = await this.getUser()
          }

          this.setTooltips(user.Tooltips)

          this.setUser(user)

          if (user.Username === 'public') {
            this.hideUnauthorizedMessage()
            this.logout()
              .then(() => {
                this.isLoadComplete = true
              })
          } else {
            if (user.ComponentTree && user.ComponentTree.length) {
              if (user.Authorized) {
                this.hideUnauthorizedMessage()
                event.emit('app:ready', user)
                if (cb) {
                  cb()
                }
              }
            }

            this.isLoadComplete = true
          }
        } catch (e) {
          this.isLoadComplete = true
        }
      },
      updateNotifications() {
        this.getNotifications()
        setInterval(() => {
          this.getNotifications()
        }, this.RequestsRefreshTime * 1000)
      },
      beforeEnterLogin(el) {
        el.style.opacity = 1
      },
      leaveLogin(el, done) {
        localStorage.setItem('sessionExpired', 'false')
        Velocity(el, {
          opacity: 0
        }, {
          duration: 500,
          complete: () => {
            this.appReady = true
            done()
          }
        })
      }
    },
    components: {
      Cfooter,
      Home,
      Login,
      textError,
      searchDetail,
      VersionMismatch,
      dialogHelper,
      ideaDialog,
      infoDialog,
      Scrollbar
    }
  }
</script>

<style lang="scss">
  .errorDialogPointer {
    cursor: pointer
  }
  @import "./stylesheet/elementui/elementui.scss";
  @import "./stylesheet/main/style.scss";
</style>
