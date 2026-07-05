pipeline {
  agent any

  stages {
    stage('Deploy') {
      steps {
        sh '''
          ssh debian-bot-1 '
            set -e
            cd /home/toby/projects/eous-tradingflow
            git fetch origin
            git reset --hard origin/dev
            docker compose up -d --build
            docker compose ps
          '
        '''
      }
    }
  }
}